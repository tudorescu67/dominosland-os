// Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex.
// Serverul asculta doar pe loopback implicit: API-ul nu are autentificare.
use crate::status;
use std::fs;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

const MAX_HEADER: usize = 8 * 1024;

pub struct Response {
    code: u16,
    ctype: &'static str,
    body: Vec<u8>,
    api: bool,
    allow: bool,
}

fn reason(code: u16) -> &'static str {
    match code {
        200 => "OK",
        400 => "Bad Request",
        404 => "Not Found",
        405 => "Method Not Allowed",
        _ => "Error",
    }
}

fn text(code: u16, msg: &str) -> Response {
    Response { code, ctype: "text/plain; charset=utf-8", body: msg.as_bytes().to_vec(), api: false, allow: code == 405 }
}

fn json_resp(body: String) -> Response {
    Response { code: 200, ctype: "application/json", body: body.into_bytes(), api: true, allow: false }
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

pub fn route(method: &str, target: &str, shell_dir: &Path) -> Response {
    if method != "GET" && method != "HEAD" {
        return text(405, "Metoda nepermisa\n");
    }
    let path = target.split(['?', '#']).next().unwrap_or("");
    match path {
        "/api/health" => json_resp("{\"ok\":true}".to_string()),
        "/api/status" => json_resp(status::collect().to_json(false)),
        _ => match resolve_static(shell_dir, target).and_then(|p| fs::read(&p).ok().map(|b| (p, b))) {
            Some((p, body)) => Response { code: 200, ctype: content_type(&p), body, api: false, allow: false },
            None => text(404, "Nu a fost gasit\n"),
        },
    }
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
    if r.allow {
        h.push_str("Allow: GET, HEAD\r\n");
    }
    h.push_str("\r\n");
    s.write_all(h.as_bytes())?;
    if !head_only {
        s.write_all(&r.body)?;
    }
    s.flush()
}

fn handle(mut s: TcpStream, shell_dir: &Path) {
    let _ = s.set_read_timeout(Some(Duration::from_secs(5)));
    let mut buf = Vec::new();
    let mut chunk = [0u8; 1024];
    let complete = loop {
        if buf.windows(4).any(|w| w == b"\r\n\r\n") {
            break true;
        }
        if buf.len() >= MAX_HEADER {
            break false;
        }
        match s.read(&mut chunk) {
            Ok(0) | Err(_) => break false,
            Ok(n) => buf.extend_from_slice(&chunk[..n]),
        }
    };
    let parsed = if complete { std::str::from_utf8(&buf).ok().and_then(parse_request) } else { None };
    let _ = match parsed {
        None => write_response(&mut s, &text(400, "Cerere invalida\n"), false),
        Some((m, t)) => write_response(&mut s, &route(m, t, shell_dir), m == "HEAD"),
    };
}

pub fn serve(listener: TcpListener, shell_dir: PathBuf) {
    let shell_dir = Arc::new(shell_dir);
    for conn in listener.incoming().flatten() {
        let dir = Arc::clone(&shell_dir);
        std::thread::spawn(move || handle(conn, &dir));
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
