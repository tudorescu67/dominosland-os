// Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex.
// Serverul asculta doar pe loopback implicit: API-ul nu are autentificare.
use crate::{actions, status};
use std::fs;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

const MAX_HEADER: usize = 8 * 1024;
const MAX_BODY: usize = 4096;

pub struct Response {
    code: u16,
    ctype: &'static str,
    body: Vec<u8>,
    api: bool,
    allow: &'static str,
}

fn reason(code: u16) -> &'static str {
    match code {
        200 => "OK",
        400 => "Bad Request",
        404 => "Not Found",
        403 => "Forbidden",
        405 => "Method Not Allowed",
        411 => "Length Required",
        413 => "Payload Too Large",
        421 => "Misdirected Request",
        500 => "Internal Server Error",
        503 => "Service Unavailable",
        504 => "Gateway Timeout",
        _ => "Error",
    }
}

fn text(code: u16, msg: &str) -> Response {
    Response { code, ctype: "text/plain; charset=utf-8", body: msg.as_bytes().to_vec(), api: false, allow: if code == 405 { "GET, HEAD" } else { "" } }
}

fn json_code(code: u16, body: String) -> Response {
    Response { code, ctype: "application/json", body: body.into_bytes(), api: true, allow: "" }
}

fn json_resp(body: String) -> Response {
    json_code(200, body)
}

fn deny(code: u16, error: &str) -> Response {
    json_code(code, format!("{{\"ok\":false,\"error\":{}}}", crate::json::string(error)))
}

/// Extrage (metoda, tinta) din linia de start; None = cerere malformata.
pub fn parse_request(head: &str) -> Option<(&str, &str)> {
    let line = head.lines().next()?;
    let mut p = line.split(' ');
    let (m, t, v) = (p.next()?, p.next()?, p.next()?);
    if p.next().is_some() || m.is_empty() || !t.starts_with('/') || !v.starts_with("HTTP/1.") {
        return None;
    }
    Some((m, t))
}

fn percent_decode(s: &str) -> Option<String> {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' {
            let hex = s.get(i + 1..i + 3)?;
            out.push(u8::from_str_radix(hex, 16).ok()?);
            i += 3;
        } else {
            out.push(b[i]);
            i += 1;
        }
    }
    String::from_utf8(out).ok()
}

/// Decodam inainte de a verifica `..`, altfel `%2e%2e` ar trece de filtru.
pub fn resolve_static(shell_dir: &Path, url_path: &str) -> Option<PathBuf> {
    let raw = url_path.split(['?', '#']).next()?;
    let decoded = percent_decode(raw)?;
    if decoded.contains('\\') || decoded.contains('\0') || !decoded.starts_with('/') {
        return None;
    }
    if decoded.split('/').any(|s| s == "..") {
        return None;
    }
    let rel = decoded.trim_start_matches('/');
    let rel = if rel.is_empty() { "index.html" } else { rel };
    let root = fs::canonicalize(shell_dir).ok()?;
    // canonicalize rezolva si symlink-urile, deci iesirea din radacina e prinsa aici.
    let full = fs::canonicalize(root.join(rel)).ok()?;
    (full.starts_with(&root) && full.is_file()).then_some(full)
}

fn content_type(p: &Path) -> &'static str {
    match p.extension().and_then(|e| e.to_str()).unwrap_or("") {
        "html" => "text/html; charset=utf-8",
        "js" => "text/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "json" => "application/json",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "ico" => "image/x-icon",
        "webmanifest" => "application/manifest+json",
        _ => "application/octet-stream",
    }
}

/// Rute doar-citire (GET/HEAD); metoda e deja verificata de apelant.
pub fn route(target: &str, shell_dir: &Path) -> Response {
    let path = target.split(['?', '#']).next().unwrap_or("");
    match path {
        "/api/health" => json_resp("{\"ok\":true}".to_string()),
        "/api/status" => json_resp(status::collect().to_json(false)),
        "/api/gamemode" => json_resp(actions::gamemode_status()),
        _ => match resolve_static(shell_dir, target).and_then(|p| fs::read(&p).ok().map(|b| (p, b))) {
            Some((p, body)) => Response { code: 200, ctype: content_type(&p), body, api: false, allow: "" },
            None => text(404, "Nu a fost gasit\n"),
        },
    }
}

/// Valoarea primului antet cu numele dat (fara diferenta mare/mic).
fn header<'a>(head: &'a str, name: &str) -> Option<&'a str> {
    head.lines().skip(1).find_map(|l| {
        let (k, v) = l.split_once(':')?;
        k.trim().eq_ignore_ascii_case(name).then(|| v.trim())
    })
}

/// Verificarile unui POST, in ordine; Err = raspunsul de trimis. Motivul exact merge doar pe stderr.
fn check_post(head: &str, host: &str) -> Result<usize, Response> {
    let refuse = |why: &str| {
        eprintln!("dominosd: cerere respinsa: {why}");
        deny(403, "Cerere respinsa")
    };
    // Antet custom: o pagina straina nu-l poate trimite fara preflight CORS, la care nu raspundem niciodata.
    if header(head, "X-DominosLand-Action") != Some("1") {
        return Err(refuse("lipseste X-DominosLand-Action"));
    }
    if header(head, "Origin") != Some(&format!("http://{host}")) {
        return Err(refuse("Origin lipsa sau straina"));
    }
    if !header(head, "Content-Type").is_some_and(|c| c.to_ascii_lowercase().starts_with("application/json")) {
        return Err(refuse("Content-Type nu e application/json"));
    }
    let len = header(head, "Content-Length").ok_or_else(|| deny(411, "Content-Length lipseste"))?;
    match len.parse::<usize>() {
        Ok(n) if n <= MAX_BODY => Ok(n),
        Ok(_) => Err(deny(413, "Corp prea mare")),
        Err(_) => Err(deny(400, "Content-Length invalid")),
    }
}

fn read_body(s: &mut TcpStream, mut body: Vec<u8>, len: usize) -> Option<Vec<u8>> {
    body.truncate(len);
    let mut chunk = [0u8; 1024];
    while body.len() < len {
        match s.read(&mut chunk) {
            Ok(0) | Err(_) => return None,
            Ok(n) => body.extend_from_slice(&chunk[..n.min(len - body.len())]),
        }
    }
    Some(body)
}

fn write_response(s: &mut TcpStream, r: &Response, head_only: bool) -> std::io::Result<()> {
    let mut h = format!(
        "HTTP/1.1 {} {}\r\nContent-Type: {}\r\nContent-Length: {}\r\nConnection: close\r\nX-Content-Type-Options: nosniff\r\n",
        r.code,
        reason(r.code),
        r.ctype,
        r.body.len()
    );
    if r.api {
        h.push_str("Cache-Control: no-store\r\n");
    }
    if !r.allow.is_empty() {
        h.push_str(&format!("Allow: {}\r\n", r.allow));
    }
    h.push_str("\r\n");
    s.write_all(h.as_bytes())?;
    if !head_only {
        s.write_all(&r.body)?;
    }
    s.flush()
}

fn respond(s: &mut TcpStream, buf: &[u8], shell_dir: &Path, port: u16) -> Response {
    let Some(end) = buf.windows(4).position(|w| w == b"\r\n\r\n") else {
        return text(400, "Cerere invalida\n");
    };
    let Some((method, target)) = std::str::from_utf8(&buf[..end]).ok().and_then(parse_request) else {
        return text(400, "Cerere invalida\n");
    };
    let head = std::str::from_utf8(&buf[..end]).unwrap_or("");
    // DNS rebinding: un domeniu strain care ajunge la 127.0.0.1 isi tradeaza Host-ul.
    let host = header(head, "Host").unwrap_or("");
    if host != format!("127.0.0.1:{port}") && host != format!("localhost:{port}") {
        return deny(421, "Host nepermis");
    }
    let path = target.split(['?', '#']).next().unwrap_or("");
    if let Some(name) = path.strip_prefix("/api/actions/") {
        if method != "POST" {
            let mut r = text(405, "Metoda nepermisa\n");
            r.allow = "POST";
            return r;
        }
        let len = match check_post(head, host) {
            Ok(n) => n,
            Err(r) => return r,
        };
        return match read_body(s, buf[end + 4..].to_vec(), len) {
            Some(body) => {
                let (code, out) = actions::dispatch(name, &body);
                json_code(code, out)
            }
            None => text(400, "Cerere invalida\n"),
        };
    }
    if method != "GET" && method != "HEAD" {
        return text(405, "Metoda nepermisa\n");
    }
    route(target, shell_dir)
}

fn handle(mut s: TcpStream, shell_dir: &Path, port: u16) {
    let _ = s.set_read_timeout(Some(Duration::from_secs(5)));
    let mut buf = Vec::new();
    let mut chunk = [0u8; 1024];
    // Corpul poate sosi in aceleasi citiri ca antetele; limita se aplica doar antetelor.
    let complete = loop {
        if let Some(p) = buf.windows(4).position(|w| w == b"\r\n\r\n") {
            break p <= MAX_HEADER;
        }
        if buf.len() >= MAX_HEADER {
            break false;
        }
        match s.read(&mut chunk) {
            Ok(0) | Err(_) => break false,
            Ok(n) => buf.extend_from_slice(&chunk[..n]),
        }
    };
    let head_only = buf.starts_with(b"HEAD ");
    let resp = if complete { respond(&mut s, &buf, shell_dir, port) } else { text(400, "Cerere invalida\n") };
    let _ = write_response(&mut s, &resp, head_only);
}

pub fn serve(listener: TcpListener, shell_dir: PathBuf) {
    let port = listener.local_addr().map(|a| a.port()).unwrap_or(0);
    let shell_dir = Arc::new(shell_dir);
    for conn in listener.incoming().flatten() {
        let dir = Arc::clone(&shell_dir);
        std::thread::spawn(move || handle(conn, &dir, port));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp() -> PathBuf {
        let d = std::env::temp_dir().join(format!("dominosd-unit-{}", std::process::id()));
        fs::create_dir_all(&d).unwrap();
        fs::write(d.join("index.html"), "x").unwrap();
        fs::write(d.join("app.js"), "x").unwrap();
        d
    }

    #[test]
    fn rejects_traversal() {
        let d = tmp();
        for p in ["/../etc/passwd", "/%2e%2e/x", "/a/..%2fb", "/a\\b", "/a%5Cb", "/a%00b", "/%zz"] {
            assert!(resolve_static(&d, p).is_none(), "{p}");
        }
    }

    #[test]
    fn accepts_normal() {
        let d = tmp();
        assert!(resolve_static(&d, "/").unwrap().ends_with("index.html"));
        assert!(resolve_static(&d, "/app.js?v=1").unwrap().ends_with("app.js"));
        assert!(resolve_static(&d, "/missing.js").is_none());
    }

    #[test]
    fn request_parsing() {
        assert_eq!(parse_request("GET /x HTTP/1.1\r\nHost: a\r\n\r\n"), Some(("GET", "/x")));
        assert_eq!(parse_request("garbage\r\n\r\n"), None);
        assert_eq!(parse_request("GET x HTTP/1.1\r\n"), None);
    }
}
