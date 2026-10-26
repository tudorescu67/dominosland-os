// Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex.
#include <iostream>
#include <string>

#include "dominosland/gamemode.hpp"

namespace gm = dominosland::gamemode;

namespace {

int usage(std::ostream& os, int code) {
    os << "Utilizare: dl-gamemode status|on|off [--dry-run] [--sysfs-root CALE] [--state-file CALE]\n"
          "  status   afiseaza 'pornit' sau 'oprit'\n"
          "  on       trece toate procesoarele pe guvernatorul performance\n"
          "  off      restaureaza guvernatorii anteriori\n"
          "  --dry-run  doar afiseaza ce s-ar face\n";
    return code;
}

}  // namespace

int main(int argc, char** argv) {
    std::string cmd;
    bool dry_run = false;
    std::filesystem::path root = gm::kDefaultRoot, state = gm::kDefaultStateFile;
    for (int i = 1; i < argc; ++i) {
        const std::string a = argv[i];
        if (a == "--help" || a == "-h") return usage(std::cout, 0);
        if (a == "--dry-run") dry_run = true;
        else if ((a == "--sysfs-root" || a == "--state-file") && i + 1 < argc) (a == "--sysfs-root" ? root : state) = argv[++i];
        else if (cmd.empty() && (a == "status" || a == "on" || a == "off")) cmd = a;
        else return usage(std::cerr, 2);
    }
    if (cmd.empty()) return usage(std::cerr, 2);

    if (cmd == "status") {
        std::cout << (gm::is_on(root) ? "pornit" : "oprit") << '\n';
        return 0;
    }
    const gm::Result r = cmd == "on" ? gm::enable(root, state, dry_run) : gm::disable(root, state, dry_run);
    (r.ok ? std::cout : std::cerr) << (r.ok ? "" : "Eroare: ") << r.message << '\n';
    if (r.ok && dry_run)
        for (const auto& a : r.actions) std::cout << "  - " << a << '\n';
    return r.ok ? 0 : 1;
}
