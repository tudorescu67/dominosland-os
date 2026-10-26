// Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex.
// Cine sta la celalalt capat al unei conexiuni pe loopback.
//
// Verificarile anti-CSRF din http.rs opresc paginile din browser, dar nu si un alt cont local (sau un
// serviciu ca root): acela trimite fara probleme Host-ul, Origin-ul si antetul asteptat. Ar putea astfel
// porni actiuni ca utilizatorul sesiunii si ar imprumuta autorizarea polkit a sesiunii active.
// De aceea fiecare conexiune trebuie sa vina de la un socket al aceluiasi UID ca dominosd.
//
// Fara crate-uri (si fara libc) nu avem SO_PEERCRED pe TCP, asa ca citim proprietarul socket-ului
// clientului din /proc/net/tcp{,6}: pe loopback socket-ul clientului apare acolo cu adresa locala =
// adresa vazuta de server ca peer si adresa de la distanta = adresa locala a serverului.
// Parserele iau &str ca sa fie testabile fara /proc real.
use std::env::VarError;
use std::fs;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr, TcpStream};
use std::time::Duration;

/// Inca atatea citiri daca intrarea lipseste la prima: /proc/net/tcp se genereaza pe bucati, iar o
/// intrare se poate muta intre bucati exact cand citim. Socket-ul exista deja cand connect() a revenit.
const RETRIES: u32 = 3;
const RETRY_SLEEP: Duration = Duration::from_millis(10);
/// Doar ESTABLISHED: intrarile TIME_WAIT nu mai au proprietar (apar cu UID 0), iar LISTEN nu e un client.
const ESTABLISHED: &str = "01";
const TABLES: [&str; 2] = ["/proc/net/tcp", "/proc/net/tcp6"];

/// Un cuvant de 32 de biti, asa cum il scrie kernelul.
///
/// Kernelul tipareste adresa cu `%08X` direct din memorie (un `__be32`, deci octetii in ordinea retelei)
/// citita ca intreg al masinii. Citind hexul inapoi ca u32 si luand `to_ne_bytes` obtinem exact octetii
/// din memorie, adica ordinea "cu puncte". Pe x86/arm64 (little-endian) hexul pare inversat:
/// 127.0.0.1 apare ca `0100007F`; pe o masina big-endian ar aparea `7F000001`, iar codul ramane corect.
fn word(hex: &str) -> Option<[u8; 4]> {
    u32::from_str_radix(hex, 16).ok().map(u32::to_ne_bytes)
}

/// `0100007F:1C9A` (IPv4) sau 32 de cifre hex (IPv6, patru cuvinte ca mai sus) + `:` + port.
/// Portul e tiparit dupa ntohs, deci e un numar obisnuit in hex.
pub fn parse_addr(s: &str) -> Option<SocketAddr> {
    let (ip, port) = s.split_once(':')?;
    // from_str_radix accepta si `+`; cerem doar cifre hex, ceea ce face si felierea de mai jos sigura.
    if port.len() != 4 || !ip.bytes().chain(port.bytes()).all(|b| b.is_ascii_hexdigit()) {
        return None;
    }
    let port = u16::from_str_radix(port, 16).ok()?;
    let ip = match ip.len() {
        8 => IpAddr::V4(Ipv4Addr::from(word(ip)?)),
        32 => {
            let mut b = [0u8; 16];
            for (i, chunk) in b.chunks_exact_mut(4).enumerate() {
                chunk.copy_from_slice(&word(&ip[i * 8..i * 8 + 8])?);
            }
            IpAddr::V6(Ipv6Addr::from(b))
        }
        _ => return None,
    };
    Some(SocketAddr::new(ip, port))
}

/// Daca serverul asculta pe [::], un client IPv4 apare ca `::ffff:127.0.0.1` pentru server, dar ca
/// 127.0.0.1 in /proc/net/tcp (si invers, pentru un socket client dual-stack din tcp6).
fn canon(a: SocketAddr) -> (IpAddr, u16) {
    (a.ip().to_canonical(), a.port())
}

/// UID-ul socket-ului ESTABLISHED cu adresa locala `local` si cea de la distanta `remote`, din textul
/// unui /proc/net/tcp sau tcp6. None = nu exista, sau intrarea gasita nu se poate citi sigur.
pub fn find_uid(table: &str, local: SocketAddr, remote: SocketAddr) -> Option<u32> {
    let (want_l, want_r) = (canon(local), canon(remote));
    let mut found = None;
    // Prima linie e antetul ("sl local_address ...").
    for line in table.lines().skip(1) {
        // sl, local_address, rem_address, st, tx:rx, tr:when, retrnsmt, uid, ...
        let f: Vec<&str> = line.split_whitespace().collect();
        if f.len() < 8 || f[3] != ESTABLISHED {
            continue;
        }
        let (Some(l), Some(r)) = (parse_addr(f[1]), parse_addr(f[2])) else {
            continue;
        };
        if canon(l) != want_l || canon(r) != want_r {
            continue;
        }
        // Intrarea e a noastra: orice nesiguranta de aici inseamna refuz, nu cautare mai departe.
        let uid = parse_decimal(f[7])?;
        if found.is_some_and(|u| u != uid) {
            return None;
        }
        found = Some(uid);
    }
    found
}

/// Proprietarul socket-ului clientului: `peer` = adresa clientului vazuta de server, `local` = adresa
/// serverului. None = nu s-a putut afla (si dupa reincercari); apelantul trebuie sa refuze.
pub fn peer_uid(peer: SocketAddr, local: SocketAddr) -> Option<u32> {
    for attempt in 0..=RETRIES {
        if attempt > 0 {
            std::thread::sleep(RETRY_SLEEP);
        }
        // tcp6 poate lipsi (IPv6 dezactivat); un client dual-stack spre 127.0.0.1 apare tot acolo.
        for path in TABLES {
            if let Some(uid) = fs::read_to_string(path).ok().and_then(|t| find_uid(&t, peer, local)) {
                return Some(uid);
            }
        }
    }
    None
}

/// Al doilea camp din linia `Uid:` (real, efectiv, salvat, fs).
pub fn parse_euid(status: &str) -> Option<u32> {
    let rest = status.lines().find_map(|l| l.strip_prefix("Uid:"))?;
    parse_decimal(rest.split_whitespace().nth(1)?)
}

/// UID-ul efectiv al procesului dominosd.
pub fn effective_uid() -> Option<u32> {
    parse_euid(&fs::read_to_string("/proc/self/status").ok()?)
}

/// Doar cifre: `parse` ar accepta si `+5`, iar aici vrem o singura forma.
fn parse_decimal(s: &str) -> Option<u32> {
    if s.is_empty() || !s.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    s.parse().ok()
}

/// UID-ul care are voie sa foloseasca dominosd: implicit UID-ul efectiv al procesului.
///
/// `DOMINOSD_ALLOWED_UID` exista pentru teste (simuleaza un apelant strain). Nu slabeste granita:
/// cine poate seta mediul lui dominosd controleaza deja procesul, deci este chiar utilizatorul sesiunii.
pub fn allowed_uid() -> Result<u32, String> {
    match std::env::var("DOMINOSD_ALLOWED_UID") {
        Ok(v) => parse_decimal(&v).ok_or_else(|| format!("DOMINOSD_ALLOWED_UID invalid: {v:?} (trebuie un numar zecimal)")),
        Err(VarError::NotUnicode(_)) => Err("DOMINOSD_ALLOWED_UID invalid (nu e text)".to_string()),
        Err(VarError::NotPresent) => {
            effective_uid().ok_or_else(|| "nu pot afla UID-ul efectiv din /proc/self/status".to_string())
        }
    }
}

/// Ok doar daca socket-ul clientului apartine lui `allowed`. Err = motivul, doar pentru stderr.
pub fn check(stream: &TcpStream, allowed: u32) -> Result<(), String> {
    let peer = stream.peer_addr().map_err(|e| format!("adresa clientului necunoscuta: {e}"))?;
    let local = stream.local_addr().map_err(|e| format!("adresa locala necunoscuta: {e}"))?;
    match peer_uid(peer, local) {
        Some(uid) if uid == allowed => Ok(()),
        Some(uid) => Err(format!("conexiune de la {peer} cu UID {uid}; este permis doar UID {allowed}")),
        None => Err(format!("proprietarul conexiunii de la {peer} nu poate fi aflat")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sa(s: &str) -> SocketAddr {
        s.parse().unwrap()
    }

    /// Hex in formatul kernelului pentru masina curenta (inversul lui `word`).
    fn hex4(a: Ipv4Addr) -> String {
        format!("{:08X}", u32::from_ne_bytes(a.octets()))
    }

    // Port 7410 = 1CF2, clienti pe 40000 (9C40), 40002 (9C42), 40008 (9C48).
    // Serverul (UID 1000) are propriile intrari pentru socket-urile acceptate; ele nu trebuie confundate
    // cu cele ale clientilor, care au alt UID.
    const TCP: &str = "  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode
   0: 0100007F:1CF2 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 2876 1 000000001ba116d3 100 0 0 10 0
   1: 0100007F:9C48 0100007F:1CF2 06 00000000:00000000 03:00001770 00000000     0        0 0 3 0000000000000000
   2: 0100007F:9C40 0100007F:1CF2 01 00000000:00000000 00:00000000 00000000  1000        0 3001 1 0000000000000000 20 4 30 10 -1
   3: 0100007F:1CF2 0100007F:9C40 01 00000000:00000000 00:00000000 00000000  1000        0 3002 1 0000000000000000 20 4 30 10 -1
   4: 0100007F:9C42 0100007F:1CF2 01 00000000:00000000 00:00000000 00000000  1001        0 3003 1 0000000000000000 20 4 30 10 -1
   5: 0100007F:1CF2 0100007F:9C42 01 00000000:00000000 00:00000000 00000000  1000        0 3004 1 0000000000000000 20 4 30 10 -1
   6: 0200007F:9C40 0100007F:1CF2 01 00000000:00000000 00:00000000 00000000  1002        0 3005 1 0000000000000000 20 4 30 10 -1
   7: 0100007F:9C40 0100007F:1CF3 01 00000000:00000000 00:00000000 00000000  1003        0 3006 1 0000000000000000 20 4 30 10 -1
";

    // ::1 port 7410 asculta; un client ::1:40004 (9C44) si un client dual-stack ::ffff:127.0.0.1:40006 (9C46).
    const TCP6: &str = "  sl  local_address                         remote_address                        st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode
   0: 00000000000000000000000001000000:1CF2 00000000000000000000000000000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 4001 1 0000000000000000 100 0 0 10 0
   1: 00000000000000000000000001000000:9C44 00000000000000000000000001000000:1CF2 01 00000000:00000000 00:00000000 00000000  1004        0 4002 1 0000000000000000 20 4 30 10 -1
   2: 00000000000000000000000001000000:1CF2 00000000000000000000000001000000:9C44 01 00000000:00000000 00:00000000 00000000  1000        0 4003 1 0000000000000000 20 4 30 10 -1
   3: 0000000000000000FFFF00000100007F:9C46 0000000000000000FFFF00000100007F:1CF2 01 00000000:00000000 00:00000000 00000000  1005        0 4004 1 0000000000000000 20 4 30 10 -1
";

    // Mostrele de mai sus sunt scrise cum le tipareste un kernel little-endian (x86/arm64).
    #[cfg(target_endian = "little")]
    #[test]
    fn parses_kernel_hex() {
        assert_eq!(parse_addr("0100007F:1C9A"), Some(sa("127.0.0.1:7322")));
        assert_eq!(parse_addr("00000000:0000"), Some(sa("0.0.0.0:0")));
        assert_eq!(parse_addr("00000000000000000000000001000000:1CF2"), Some(sa("[::1]:7410")));
        assert_eq!(parse_addr("0000000000000000FFFF00000100007F:9C46"), Some(sa("[::ffff:127.0.0.1]:40006")));
        assert_eq!(parse_addr("0100007f:1c9a"), Some(sa("127.0.0.1:7322")));
    }

    #[test]
    fn rejects_bad_hex() {
        for s in [
            "", "0100007F", "0100007F:", ":1C9A", "0100007G:1C9A", "+100007F:1C9A", "0100007F:+C9A",
            "0100007F:1C9", "0100007F:01C9A", "100007F:1C9A", "0100007F0:1C9A", "0100007F:1C9A:00",
            "ț100007F:1C9A", "0000000000000000000000000100000:1CF2",
        ] {
            assert_eq!(parse_addr(s), None, "{s:?}");
        }
    }

    #[test]
    fn round_trip_any_endianness() {
        let ip = Ipv4Addr::new(192, 168, 1, 20);
        assert_eq!(parse_addr(&format!("{}:0050", hex4(ip))), Some(SocketAddr::new(ip.into(), 80)));
    }

    #[cfg(target_endian = "little")]
    #[test]
    fn finds_client_not_server_side() {
        let srv = sa("127.0.0.1:7410");
        // Doi clienti cu UID-uri diferite; intrarile serverului (UID 1000) nu se potrivesc invers.
        assert_eq!(find_uid(TCP, sa("127.0.0.1:40000"), srv), Some(1000));
        assert_eq!(find_uid(TCP, sa("127.0.0.1:40002"), srv), Some(1001));
        // Acelasi port, alta adresa: 127.0.0.2:40000 e alt socket.
        assert_eq!(find_uid(TCP, sa("127.0.0.2:40000"), srv), Some(1002));
        // Acelasi client, alt port de server.
        assert_eq!(find_uid(TCP, sa("127.0.0.1:40000"), sa("127.0.0.1:7411")), Some(1003));
        // Doar TIME_WAIT (UID 0) sau inexistent: nimic.
        assert_eq!(find_uid(TCP, sa("127.0.0.1:40008"), srv), None);
        assert_eq!(find_uid(TCP, sa("127.0.0.1:40010"), srv), None);
        // LISTEN nu e client.
        assert_eq!(find_uid(TCP, sa("0.0.0.0:0"), srv), None);
        // Directia conteaza: intrebarea inversa gaseste socket-ul serverului (1000), nu pe al clientului (1001).
        assert_eq!(find_uid(TCP, srv, sa("127.0.0.1:40002")), Some(1000));
    }

    #[cfg(target_endian = "little")]
    #[test]
    fn finds_ipv6_and_mapped() {
        assert_eq!(find_uid(TCP6, sa("[::1]:40004"), sa("[::1]:7410")), Some(1004));
        // Client dual-stack: serverul IPv4 il vede ca 127.0.0.1, tcp6 il arata ca ::ffff:127.0.0.1.
        assert_eq!(find_uid(TCP6, sa("127.0.0.1:40006"), sa("127.0.0.1:7410")), Some(1005));
        assert_eq!(find_uid(TCP6, sa("[::ffff:127.0.0.1]:40006"), sa("[::ffff:127.0.0.1]:7410")), Some(1005));
        // Server pe [::], client IPv4: serverul vede adrese mapate, clientul e in tcp ca 127.0.0.1.
        assert_eq!(find_uid(TCP, sa("[::ffff:127.0.0.1]:40002"), sa("[::ffff:127.0.0.1]:7410")), Some(1001));
        // ::1 nu e 127.0.0.1.
        assert_eq!(find_uid(TCP6, sa("127.0.0.1:40004"), sa("127.0.0.1:7410")), None);
    }

    #[cfg(target_endian = "little")]
    #[test]
    fn unsure_match_fails_closed() {
        let head = TCP.lines().next().unwrap();
        let e = "   0: 0100007F:9C40 0100007F:1CF2 01 00000000:00000000 00:00000000 00000000";
        let (c, s) = (sa("127.0.0.1:40000"), sa("127.0.0.1:7410"));
        assert_eq!(find_uid(&format!("{head}\n{e}  abc 0 1\n"), c, s), None);
        assert_eq!(find_uid(&format!("{head}\n{e}  -1 0 1\n"), c, s), None);
        assert_eq!(find_uid(&format!("{head}\n{e}\n"), c, s), None);
        // Doua intrari ESTABLISHED identice cu UID-uri diferite: ambiguu, deci refuz.
        assert_eq!(find_uid(&format!("{head}\n{e}  1000 0 1\n{e}  1001 0 2\n"), c, s), None);
        assert_eq!(find_uid(&format!("{head}\n{e}  1000 0 1\n"), c, s), Some(1000));
        // Fara antet, prima linie e ignorata (kernelul o scrie mereu).
        assert_eq!(find_uid(&format!("{e}  1000 0 1\n"), c, s), None);
        assert_eq!(find_uid("", c, s), None);
    }

    #[test]
    fn effective_uid_from_status() {
        let t = "Name:\tdominosd\nUmask:\t0022\nState:\tS (sleeping)\nUid:\t1000\t1001\t1001\t1001\nGid:\t100\t100\t100\t100\n";
        assert_eq!(parse_euid(t), Some(1001));
        assert_eq!(parse_euid("Uid:\t1000\n"), None);
        assert_eq!(parse_euid("Uid:\t1000\t+5\t0\t0\n"), None);
        assert_eq!(parse_euid("Gid:\t0\t0\t0\t0\n"), None);
        assert!(effective_uid().is_some());
    }

    #[test]
    fn decimal_only() {
        assert_eq!(parse_decimal("0"), Some(0));
        assert_eq!(parse_decimal("12345"), Some(12345));
        for s in ["", "+5", "-1", " 5", "5 ", "0x10", "4294967296", "١"] {
            assert_eq!(parse_decimal(s), None, "{s:?}");
        }
    }

    #[test]
    fn real_loopback_connection_is_ours() {
        // Pe Linux real: socket-ul clientului deschis de acest proces apare cu UID-ul nostru efectiv.
        let l = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let c = TcpStream::connect(l.local_addr().unwrap()).unwrap();
        let (s, _) = l.accept().unwrap();
        assert_eq!(c.local_addr().unwrap(), s.peer_addr().unwrap());
        assert_eq!(peer_uid(s.peer_addr().unwrap(), s.local_addr().unwrap()), effective_uid());
        let me = effective_uid().unwrap();
        assert!(check(&s, me).is_ok());
        assert!(check(&s, me.wrapping_add(1)).unwrap_err().contains("UID"));
    }
}
