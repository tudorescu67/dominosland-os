// Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex.
mod actions;
mod http;
mod json;
mod status;

use std::net::TcpListener;
use std::path::PathBuf;
use std::process::exit;

const USAGE: &str = "DominosLand OS - dominosd\n\n\
Utilizare:\n  dominosd status [--compact]\n  dominosd serve [--addr 127.0.0.1:7410] [--shell-dir /usr/share/dominosland/shell]\n  dominosd --version\n  dominosd --help\n";

fn usage_err() -> ! {
    eprint!("{USAGE}");
    exit(2)
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match args.first().map(String::as_str) {
        Some("--version") | Some("-V") => println!("dominosd {}", env!("CARGO_PKG_VERSION")),
        Some("--help") | Some("-h") => print!("{USAGE}"),
        Some("status") => {
            let compact = match &args[1..] {
                [] => false,
                [f] if f == "--compact" => true,
                _ => usage_err(),
            };
            println!("{}", status::collect().to_json(!compact));
        }
        Some("serve") => serve(&args[1..]),
        _ => usage_err(),
    }
}

fn serve(args: &[String]) {
    let mut addr = std::env::var("DOMINOSD_ADDR").unwrap_or_else(|_| "127.0.0.1:7410".into());
    let mut dir = std::env::var("DOMINOSD_SHELL_DIR")
        .unwrap_or_else(|_| "/usr/share/dominosland/shell".into());
    let mut it = args.iter();
    while let Some(a) = it.next() {
        match (a.as_str(), it.next()) {
            ("--addr", Some(v)) => addr = v.clone(),
            ("--shell-dir", Some(v)) => dir = v.clone(),
            _ => usage_err(),
        }
    }
    let listener = TcpListener::bind(&addr).unwrap_or_else(|e| {
        eprintln!("dominosd: nu pot asculta pe {addr}: {e}");
        exit(1)
    });
    // Adresa reala (portul poate fi 0); testele si scripturile o citesc de aici.
    let local = listener.local_addr().map(|a| a.to_string()).unwrap_or(addr);
    println!("dominosd asculta pe {local}");
    use std::io::Write;
    let _ = std::io::stdout().flush();
    http::serve(listener, PathBuf::from(dir));
}
