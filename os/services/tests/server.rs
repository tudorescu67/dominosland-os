// Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex.
use std::io::{BufRead, BufReader, Read, Write};
use std::net::TcpStream;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};

struct Server {
    child: Child,
    addr: String,
}

impl Drop for Server {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

fn start(dir: &Path, envs: &[(&str, &Path)]) -> Server {
    let mut cmd = Command::new(env!("CARGO_BIN_EXE_dominosd"));
    cmd.args(["serve", "--addr", "127.0.0.1:0", "--shell-dir"]).arg(dir).stdout(Stdio::piped());
    for (k, v) in envs {
        cmd.env(k, v);
    }
    let mut child = cmd.spawn().unwrap();
    let mut line = String::new();
    BufReader::new(child.stdout.take().unwrap()).read_line(&mut line).unwrap();
    let addr = line.trim().rsplit(' ').next().unwrap().to_string();
    Server { child, addr }
}

struct Resp {
    status: u16,
    headers: String,
    body: String,
}

/// Trimite text HTTP brut si desparte raspunsul in status, antete si corp.
fn raw(addr: &str, req: &str) -> Resp {
    let mut s = TcpStream::connect(addr).unwrap();
    s.write_all(req.as_bytes()).unwrap();
    let mut out = String::new();
    s.read_to_string(&mut out).unwrap();
    let (headers, body) = out.split_once("\r\n\r\n").unwrap_or((&out, ""));
    let status = headers.split(' ').nth(1).and_then(|c| c.parse().ok()).unwrap_or(0);
    Resp { status, headers: headers.to_string(), body: body.to_string() }
}

fn get(addr: &str, path: &str) -> Resp {
    raw(addr, &format!("GET {path} HTTP/1.1\r\nHost: {addr}\r\n\r\n"))
}

/// POST cu antete configurabile (action, origin, extra) ca sa putem strica cate unul.
fn post_with(addr: &str, path: &str, body: &str, action: bool, origin: &str, extra: &str) -> Resp {
    let act = if action { "X-DominosLand-Action: 1\r\n" } else { "" };
    raw(
        addr,
        &format!("POST {path} HTTP/1.1\r\nHost: {addr}\r\n{act}Origin: {origin}\r\nContent-Type: application/json\r\n{extra}\r\n{body}"),
    )
}

fn post(addr: &str, path: &str, body: &str) -> Resp {
    let cl = format!("Content-Length: {}\r\n", body.len());
    post_with(addr, path, body, true, &format!("http://{addr}"), &cl)
}

fn script(dir: &Path, name: &str, body: &str) -> PathBuf {
    let p = dir.join(name);
    std::fs::write(&p, format!("#!/bin/sh\n{body}\n")).unwrap();
    std::fs::set_permissions(&p, std::fs::Permissions::from_mode(0o755)).unwrap();
    p
}

fn tmpdir(tag: &str) -> PathBuf {
    let d = std::env::temp_dir().join(format!("dominosd-it-{tag}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&d);
    std::fs::create_dir_all(&d).unwrap();
    d
}

#[test]
fn serves_shell_and_api() {
    let dir = tmpdir("shell");
    std::fs::write(dir.join("index.html"), "<h1>DominosLand</h1>").unwrap();
    let srv = start(&dir, &[]);
    let a = &srv.addr;

    let r = get(a, "/");
    assert_eq!(r.status, 200, "{}", r.headers);
    assert!(r.headers.contains("text/html") && r.body.contains("<h1>DominosLand</h1>"));

    let r = get(a, "/api/health");
    assert!(r.status == 200 && r.body == "{\"ok\":true}");
    assert!(r.headers.contains("Cache-Control: no-store") && r.headers.contains("nosniff"));

    let r = get(a, "/api/status");
    assert!(r.status == 200 && r.body.contains("uptime_seconds"), "{}", r.body);

    assert_eq!(get(a, "/../x").status, 404);
    assert_eq!(get(a, "/%2e%2e/x").status, 404);

    // POST pe o ruta GET: 405 (Host corect, ca sa ajunga pana la verificarea metodei).
    let r = raw(a, &format!("POST /api/health HTTP/1.1\r\nHost: {a}\r\nContent-Length: 0\r\n\r\n"));
    assert_eq!(r.status, 405, "{}", r.headers);
    // GET pe o ruta de actiune: tot 405.
    assert_eq!(get(a, "/api/actions/launcher").status, 405);

    assert_eq!(raw(a, "nonsens\r\n\r\n").status, 400);

    for r in [get(a, "/"), get(a, "/api/status"), get(a, "/nope"), get(a, "/api/gamemode")] {
        assert!(!r.headers.to_lowercase().contains("access-control-"));
        assert!(r.headers.contains("Content-Length:") && r.headers.contains("Connection: close"));
    }
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn host_check() {
    let dir = tmpdir("host");
    let srv = start(&dir, &[]);
    let a = &srv.addr;
    let port = a.rsplit(':').next().unwrap();
    let bad = |host: &str| {
        let req = if host.is_empty() { "GET /api/health HTTP/1.1\r\n\r\n".to_string() } else { format!("GET /api/health HTTP/1.1\r\nHost: {host}\r\n\r\n") };
        raw(a, &req)
    };
    for h in ["evil.example", "evil.example:80", "127.0.0.1", "127.0.0.1:1", &format!("evil.example:{port}"), &format!("127.0.0.1.evil.example:{port}"), ""] {
        let r = bad(h);
        assert_eq!(r.status, 421, "{h}");
        assert_eq!(r.body, "{\"ok\":false,\"error\":\"Host nepermis\"}");
        assert!(!r.headers.to_lowercase().contains("access-control-"));
    }
    assert_eq!(bad(&format!("localhost:{port}")).status, 200);
    assert_eq!(bad(&format!("127.0.0.1:{port}")).status, 200);
    assert_eq!(get(a, "/api/status").status, 200);
    // Host gresit si la POST si la rute statice.
    assert_eq!(raw(a, "POST /api/actions/launcher HTTP/1.1\r\nHost: x\r\n\r\n").status, 421);
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn post_protections() {
    let dir = tmpdir("csrf");
    let log = dir.join("sysctl.log");
    let sys = script(&dir, "systemctl", &format!("echo \"$@\" >> {}", log.display()));
    let srv = start(&dir, &[("DL_SYSTEMCTL", &sys)]);
    let a = &srv.addr;
    let p = "/api/actions/gamemode";
    let ok_origin = format!("http://{a}");
    let cl = |b: &str| format!("Content-Length: {}\r\n", b.len());
    let body = "{\"on\":true}";

    let r = post_with(a, p, body, false, &ok_origin, &cl(body));
    assert_eq!(r.status, 403);
    assert_eq!(r.body, "{\"ok\":false,\"error\":\"Cerere respinsa\"}");
    assert_eq!(post_with(a, p, body, true, "http://evil.example", &cl(body)).status, 403);
    assert_eq!(post_with(a, p, body, true, &format!("http://localhost:{}", a.rsplit(':').next().unwrap()), &cl(body)).status, 403);
    // Fara Origin deloc.
    let r = raw(a, &format!("POST {p} HTTP/1.1\r\nHost: {a}\r\nX-DominosLand-Action: 1\r\nContent-Type: application/json\r\nContent-Length: 0\r\n\r\n"));
    assert_eq!(r.status, 403);
    // Content-Type gresit.
    let r = raw(a, &format!("POST {p} HTTP/1.1\r\nHost: {a}\r\nX-DominosLand-Action: 1\r\nOrigin: {ok_origin}\r\nContent-Type: text/plain\r\nContent-Length: {}\r\n\r\n{body}", body.len()));
    assert_eq!(r.status, 403);
    assert_eq!(post_with(a, p, body, true, &ok_origin, "").status, 411);
    assert_eq!(post_with(a, p, "", true, &ok_origin, "Content-Length: 4097\r\n").status, 413);
    assert_eq!(post(a, p, "{nu json").status, 400);
    assert_eq!(post(a, p, "{\"on\":{\"x\":1}}").status, 400);
    assert_eq!(post(a, p, "{\"on\":1}").status, 400);
    assert_eq!(post(a, p, "{}").status, 400);
    assert!(!log.exists(), "nimic respins nu trebuia sa ruleze systemctl");

    let r = post(a, p, body);
    assert_eq!(r.status, 200, "{}", r.body);
    assert_eq!(r.body, "{\"ok\":true,\"message\":\"Modul joc a fost pornit.\"}");
    assert!(r.headers.contains("Cache-Control: no-store") && !r.headers.to_lowercase().contains("access-control-"));
    assert_eq!(std::fs::read_to_string(&log).unwrap(), "start dl-gamemode@on.service\n");
    let r = post(a, p, "{\"on\":false}");
    assert!(r.body.contains("oprit."));
    assert_eq!(std::fs::read_to_string(&log).unwrap(), "start dl-gamemode@on.service\nstart dl-gamemode@off.service\n");

    assert_eq!(post(a, "/api/actions/nope", "{}").status, 404);
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn gamemode_failure_and_missing() {
    let dir = tmpdir("gmfail");
    let sys = script(&dir, "systemctl", "echo 'unitate lipsa' >&2; exit 3");
    let srv = start(&dir, &[("DL_SYSTEMCTL", &sys)]);
    let r = post(&srv.addr, "/api/actions/gamemode", "{\"on\":true}");
    assert_eq!(r.status, 500);
    assert_eq!(r.body, "{\"ok\":false,\"error\":\"unitate lipsa\"}");
    drop(srv);
    let missing = dir.join("nu-exista");
    let srv = start(&dir, &[("DL_SYSTEMCTL", &missing)]);
    assert_eq!(post(&srv.addr, "/api/actions/gamemode", "{\"on\":true}").status, 503);
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn jarvis_argv_is_not_shell() {
    let dir = tmpdir("jarvis");
    let bin = script(&dir, "dl-jarvis", "echo \"$#\"; for a in \"$@\"; do echo \"[$a]\"; done");
    let srv = start(&dir, &[("DL_JARVIS_BIN", &bin)]);
    let a = &srv.addr;
    let r = post(a, "/api/actions/jarvis", "{\"text\":\"  deschide \\\"a b\\\"; rm -rf /  \"}");
    assert_eq!(r.status, 200, "{}", r.body);
    assert_eq!(r.body, "{\"ok\":true,\"message\":\"2\\n[--]\\n[deschide \\\"a b\\\"; rm -rf /]\"}");
    for bad in ["{}", "{\"text\":5}", "{\"text\":\"   \"}", &format!("{{\"text\":\"{}\"}}", "a".repeat(501))] {
        assert_eq!(post(a, "/api/actions/jarvis", bad).status, 400, "{bad}");
    }
    assert_eq!(post(a, "/api/actions/jarvis", &format!("{{\"text\":\"{}\"}}", "ț".repeat(500))).status, 200);
    drop(srv);

    let fail = script(&dir, "fail", "echo oops >&2; exit 1");
    let srv = start(&dir, &[("DL_JARVIS_BIN", &fail)]);
    let r = post(&srv.addr, "/api/actions/jarvis", "{\"text\":\"x\"}");
    assert_eq!(r.body, "{\"ok\":false,\"message\":\"oops\"}");
    drop(srv);

    let srv = start(&dir, &[("DL_JARVIS_BIN", &dir.join("lipsa"))]);
    let r = post(&srv.addr, "/api/actions/jarvis", "{\"text\":\"x\"}");
    assert_eq!((r.status, r.body.as_str()), (503, "{\"ok\":false,\"error\":\"Jarvis nu este instalat.\"}"));
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn launcher_spawn_and_missing() {
    let dir = tmpdir("launcher");
    let mark = dir.join("started");
    let bin = script(&dir, "launcher", &format!("echo \"$#\" > {}", mark.display()));
    let srv = start(&dir, &[("DL_LAUNCHER_CMD", &bin)]);
    let r = post(&srv.addr, "/api/actions/launcher", "{}");
    assert_eq!(r.status, 200);
    assert_eq!(r.body, "{\"ok\":true,\"message\":\"Launcherul porneste.\"}");
    for _ in 0..50 {
        if mark.exists() && std::fs::read_to_string(&mark).unwrap().ends_with('\n') {
            break;
        }
        std::thread::sleep(std::time::Duration::from_millis(100));
    }
    assert_eq!(std::fs::read_to_string(&mark).unwrap(), "0\n");
    drop(srv);

    let srv = start(&dir, &[("DL_LAUNCHER_CMD", &dir.join("lipsa"))]);
    let r = post(&srv.addr, "/api/actions/launcher", "{}");
    assert_eq!(r.status, 503);
    assert_eq!(r.body, "{\"ok\":false,\"error\":\"Launcherul DominosLand nu este instalat.\"}");
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn gamemode_status_route() {
    let dir = tmpdir("gmstatus");
    for (out, want) in [("pornit", "{\"active\":true}"), ("oprit", "{\"active\":false}"), ("altceva", "{\"active\":null}")] {
        let bin = script(&dir, "dl-gamemode", &format!("[ \"$1\" = status ] && echo {out}"));
        let srv = start(&dir, &[("DL_GAMEMODE_BIN", &bin)]);
        let r = get(&srv.addr, "/api/gamemode");
        assert_eq!((r.status, r.body.as_str()), (200, want));
        assert!(r.headers.contains("Cache-Control: no-store"));
    }
    let srv = start(&dir, &[("DL_GAMEMODE_BIN", &dir.join("lipsa"))]);
    assert_eq!(get(&srv.addr, "/api/gamemode").body, "{\"active\":null}");
    let _ = std::fs::remove_dir_all(&dir);
}
