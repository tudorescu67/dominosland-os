// Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex.
use std::io::{BufRead, BufReader, Read, Write};
use std::net::TcpStream;
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

fn start(dir: &std::path::Path) -> Server {
    let mut child = Command::new(env!("CARGO_BIN_EXE_dominosd"))
        .args(["serve", "--addr", "127.0.0.1:0", "--shell-dir"])
        .arg(dir)
        .stdout(Stdio::piped())
        .spawn()
        .unwrap();
    let mut line = String::new();
    BufReader::new(child.stdout.take().unwrap()).read_line(&mut line).unwrap();
    let addr = line.trim().rsplit(' ').next().unwrap().to_string();
    Server { child, addr }
}

fn request(addr: &str, raw: &str) -> String {
    let mut s = TcpStream::connect(addr).unwrap();
    s.write_all(raw.as_bytes()).unwrap();
    let mut out = String::new();
    s.read_to_string(&mut out).unwrap();
    out
}

fn get(addr: &str, path: &str) -> String {
    request(addr, &format!("GET {path} HTTP/1.1\r\nHost: x\r\n\r\n"))
}

#[test]
fn serves_shell_and_api() {
    let dir = std::env::temp_dir().join(format!("dominosd-it-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    std::fs::write(dir.join("index.html"), "<h1>DominosLand</h1>").unwrap();
    let srv = start(&dir);
    let a = &srv.addr;

    let r = get(a, "/");
    assert!(r.starts_with("HTTP/1.1 200"), "{r}");
    assert!(r.contains("text/html") && r.contains("<h1>DominosLand</h1>"));

    let r = get(a, "/api/health");
    assert!(r.starts_with("HTTP/1.1 200") && r.ends_with("{\"ok\":true}"), "{r}");
    assert!(r.contains("Cache-Control: no-store") && r.contains("nosniff"));

    let r = get(a, "/api/status");
    assert!(r.starts_with("HTTP/1.1 200") && r.contains("uptime_seconds"), "{r}");

    assert!(get(a, "/../x").starts_with("HTTP/1.1 404"));
    assert!(get(a, "/%2e%2e/x").starts_with("HTTP/1.1 404"));

    let r = request(a, "POST /api/health HTTP/1.1\r\nHost: x\r\nContent-Length: 0\r\n\r\n");
    assert!(r.starts_with("HTTP/1.1 405"), "{r}");

    assert!(request(a, "nonsens\r\n\r\n").starts_with("HTTP/1.1 400"));

    for r in [get(a, "/"), get(a, "/api/status"), get(a, "/nope")] {
        assert!(!r.to_lowercase().contains("access-control-allow-origin"));
        assert!(r.contains("Content-Length:") && r.contains("Connection: close"));
    }
    let _ = std::fs::remove_dir_all(&dir);
}
