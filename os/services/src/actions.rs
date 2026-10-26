// Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex.
// Actiunile rulate din shell. Programele externe primesc mereu argv (niciodata shell),
// iar cererile ajung aici doar dupa verificarile anti-CSRF din http.rs.
use crate::json::{self, Flat};
use std::io::{ErrorKind, Read};
use std::os::unix::process::CommandExt;
use std::process::{Command, Output, Stdio};
use std::time::{Duration, Instant};

const MAX_OUT: usize = 64 * 1024;

#[derive(Debug)]
pub enum RunError {
    NotFound,
    Timeout,
    Other(String),
}

/// Citim pana la EOF dar pastram doar MAX_OUT: daca am inceta sa citim, copilul ar bloca pe pipe plin.
fn drain(mut r: impl Read + Send + 'static) -> std::thread::JoinHandle<Vec<u8>> {
    std::thread::spawn(move || {
        let (mut out, mut buf) = (Vec::new(), [0u8; 4096]);
        while let Ok(n) = r.read(&mut buf) {
            if n == 0 {
                break;
            }
            let room = MAX_OUT.saturating_sub(out.len());
            out.extend_from_slice(&buf[..n.min(room)]);
        }
        out
    })
}

pub fn run_with_timeout(cmd: &str, args: &[&str], timeout: Duration) -> Result<Output, RunError> {
    let mut child = Command::new(cmd)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| match e.kind() {
            ErrorKind::NotFound => RunError::NotFound,
            _ => RunError::Other(e.to_string()),
        })?;
    let (out, err) = (drain(child.stdout.take().unwrap()), drain(child.stderr.take().unwrap()));
    let deadline = Instant::now() + timeout;
    let status = loop {
        match child.try_wait() {
            Ok(Some(s)) => break s,
            Ok(None) if Instant::now() >= deadline => {
                let _ = child.kill();
                let _ = child.wait();
                // Cititorii nu sunt asteptati: un proces nepot ar putea tine pipe-ul deschis.
                return Err(RunError::Timeout);
            }
            Ok(None) => std::thread::sleep(Duration::from_millis(50)),
            Err(e) => return Err(RunError::Other(e.to_string())),
        }
    };
    Ok(Output { status, stdout: out.join().unwrap_or_default(), stderr: err.join().unwrap_or_default() })
}

fn env_or(name: &str, default: &str) -> String {
    std::env::var(name).unwrap_or_else(|_| default.to_string())
}

fn err_body(msg: &str) -> String {
    format!("{{\"ok\":false,\"error\":{}}}", json::string(msg))
}

fn ok_body(msg: &str) -> String {
    format!("{{\"ok\":true,\"message\":{}}}", json::string(msg))
}

/// GET /api/gamemode: orice dubiu inseamna `null`, ca interfata sa nu arate o stare inventata.
pub fn gamemode_status() -> String {
    let bin = env_or("DL_GAMEMODE_BIN", "dl-gamemode");
    let active = match run_with_timeout(&bin, &["status"], Duration::from_secs(5)) {
        Ok(o) => match String::from_utf8_lossy(&o.stdout).trim() {
            "pornit" => "true",
            "oprit" => "false",
            _ => "null",
        },
        Err(_) => "null",
    };
    format!("{{\"active\":{active}}}")
}

fn launcher() -> (u16, String) {
    let bin = env_or("DL_LAUNCHER_CMD", "dominosland-launcher");
    // Grup propriu de procese: launcherul trebuie sa supravietuiasca daca dominosd se opreste.
    match Command::new(&bin)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .process_group(0)
        .spawn()
    {
        Ok(mut child) => {
            // wait() intr-un fir doar ca sa nu ramana zombie.
            std::thread::spawn(move || {
                let _ = child.wait();
            });
            (200, ok_body("Launcherul porneste."))
        }
        Err(e) if e.kind() == ErrorKind::NotFound => (503, err_body("Launcherul DominosLand nu este instalat.")),
        Err(e) => {
            eprintln!("dominosd: launcher: {e}");
            (500, err_body("Nu am putut porni launcherul."))
        }
    }
}

fn gamemode(body: &Flat) -> (u16, String) {
    let Some(on) = body.get_bool("on") else {
        return (400, err_body("Campul \"on\" trebuie sa fie true sau false."));
    };
    let sys = env_or("DL_SYSTEMCTL", "systemctl");
    let unit = if on { "dl-gamemode@on.service" } else { "dl-gamemode@off.service" };
    match run_with_timeout(&sys, &["start", unit], Duration::from_secs(15)) {
        Ok(o) if o.status.success() => {
            (200, ok_body(if on { "Modul joc a fost pornit." } else { "Modul joc a fost oprit." }))
        }
        Ok(o) => {
            let e = String::from_utf8_lossy(&o.stderr);
            let e = e.trim();
            (500, err_body(if e.is_empty() { "Schimbarea modului joc a esuat." } else { e }))
        }
        Err(RunError::NotFound) => (503, err_body("systemctl nu este disponibil.")),
        Err(RunError::Timeout) => (504, err_body("Schimbarea modului joc a durat prea mult.")),
        Err(RunError::Other(e)) => {
            eprintln!("dominosd: gamemode: {e}");
            (500, err_body("Schimbarea modului joc a esuat."))
        }
    }
}

fn jarvis(body: &Flat) -> (u16, String) {
    let text = body.get_str("text").map(str::trim).unwrap_or("");
    if text.is_empty() || text.chars().count() > 500 {
        return (400, err_body("Textul trebuie sa aiba 1-500 de caractere."));
    }
    let bin = env_or("DL_JARVIS_BIN", "dl-jarvis");
    // `--` ca textul utilizatorului sa nu fie niciodata luat drept optiune.
    match run_with_timeout(&bin, &["--", text], Duration::from_secs(20)) {
        Ok(o) => {
            let out = String::from_utf8_lossy(&o.stdout);
            let msg = if out.trim().is_empty() { String::from_utf8_lossy(&o.stderr).into_owned() } else { out.into_owned() };
            (200, format!("{{\"ok\":{},\"message\":{}}}", o.status.success(), json::string(msg.trim())))
        }
        Err(RunError::NotFound) => (503, err_body("Jarvis nu este instalat.")),
        Err(RunError::Timeout) => (504, err_body("Jarvis nu a raspuns la timp.")),
        Err(RunError::Other(e)) => {
            eprintln!("dominosd: jarvis: {e}");
            (500, err_body("Jarvis a esuat."))
        }
    }
}

/// `name` = ce urmeaza dupa `/api/actions/`.
pub fn dispatch(name: &str, body: &[u8]) -> (u16, String) {
    if !matches!(name, "launcher" | "gamemode" | "jarvis") {
        return (404, err_body("Actiune necunoscuta"));
    }
    let Some(flat) = std::str::from_utf8(body).ok().and_then(json::parse_flat) else {
        return (400, err_body("JSON invalid"));
    };
    match name {
        "launcher" => launcher(),
        "gamemode" => gamemode(&flat),
        _ => jarvis(&flat),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn timeout_kills_and_reports() {
        let r = run_with_timeout("sleep", &["5"], Duration::from_millis(200));
        assert!(matches!(r, Err(RunError::Timeout)));
    }

    #[test]
    fn captures_output_and_not_found() {
        let o = run_with_timeout("echo", &["salut"], Duration::from_secs(5)).unwrap();
        assert_eq!(String::from_utf8_lossy(&o.stdout).trim(), "salut");
        assert!(matches!(run_with_timeout("nu-exista-xyz", &[], Duration::from_secs(1)), Err(RunError::NotFound)));
    }

    #[test]
    fn output_is_capped() {
        let o = run_with_timeout("head", &["-c", "300000", "/dev/zero"], Duration::from_secs(5)).unwrap();
        assert_eq!(o.stdout.len(), MAX_OUT);
    }
}
