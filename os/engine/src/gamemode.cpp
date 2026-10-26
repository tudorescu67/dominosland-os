// Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex.
#include "dominosland/gamemode.hpp"

#include <algorithm>
#include <cstdlib>
#include <fstream>
#include <regex>
#include <set>
#include <system_error>

namespace fs = std::filesystem;

namespace dominosland::gamemode {
namespace {

std::string trim(std::string s) {
    const char* ws = " \t\r\n";
    s.erase(s.find_last_not_of(ws) + 1);
    s.erase(0, s.find_first_not_of(ws));
    return s;
}

std::string read_trimmed(const fs::path& p) {
    std::ifstream in(p);
    std::string s;
    std::getline(in, s);
    return trim(s);
}

bool write_text(const fs::path& p, const std::string& value, std::string& err) {
    std::ofstream out(p, std::ios::trunc);
    out << value << '\n';
    out.flush();
    if (!out) {
        err = "nu pot scrie in " + p.string() + " (permisiune refuzata? ruleaza ca root sau prin serviciul dominosland)";
        return false;
    }
    return true;
}

Result fail(std::string msg) { return Result{false, std::move(msg), {}}; }

}  // namespace

std::vector<fs::path> governor_files(const fs::path& root) {
    static const std::regex cpu_re("^cpu([0-9]+)$");
    std::vector<std::pair<unsigned long, fs::path>> found;
    std::error_code ec;
    for (fs::directory_iterator it(root / "devices/system/cpu", ec), end; !ec && it != end; it.increment(ec)) {
        const std::string name = it->path().filename().string();
        std::smatch m;
        if (!std::regex_match(name, m, cpu_re)) continue;
        fs::path g = it->path() / "cpufreq/scaling_governor";
        if (fs::is_regular_file(g, ec)) found.emplace_back(std::stoul(m[1]), g);
    }
    // Sortare numerica: sortarea lexicografica ar pune cpu10 inaintea lui cpu2.
    std::sort(found.begin(), found.end());
    std::vector<fs::path> out;
    for (auto& f : found) out.push_back(std::move(f.second));
    return out;
}

bool is_on(const fs::path& root) {
    const auto files = governor_files(root);
    return !files.empty() && std::all_of(files.begin(), files.end(),
                                         [](const fs::path& p) { return read_trimmed(p) == "performance"; });
}

Result enable(const fs::path& root, const fs::path& state_file, bool dry_run) {
    if (is_on(root)) return Result{true, "Modul de joc este deja pornit.", {}};
    const auto files = governor_files(root);
    if (files.empty()) return fail("Nu am gasit niciun procesor cu cpufreq sub " + root.string() + ".");

    Result r{true, dry_run ? "Simulare: modul de joc ar fi pornit." : "Modul de joc a fost pornit.", {}};
    std::string state;
    for (const auto& f : files) state += f.string() + '\t' + read_trimmed(f) + '\n';
    r.actions.push_back("scriu starea anterioara in " + state_file.string());
    for (const auto& f : files) r.actions.push_back("scriu performance in " + f.string());
    if (dry_run) return r;

    // Starea se salveaza prima: daca scrierea guvernatorilor pica la jumatate, disable poate restaura.
    std::error_code ec;
    if (state_file.has_parent_path()) fs::create_directories(state_file.parent_path(), ec);
    std::ofstream out(state_file, std::ios::trunc);
    out << state;
    out.flush();
    if (!out) return fail("Nu pot salva starea in " + state_file.string() + " (ruleaza ca root sau prin serviciul dominosland).");
    out.close();

    std::string err;
    for (const auto& f : files)
        if (!write_text(f, "performance", err)) return fail(err);
    return r;
}

Result disable(const fs::path& root, const fs::path& state_file, bool dry_run) {
    std::ifstream in(state_file);
    if (!in) return Result{true, "Modul de joc nu era pornit.", {}};

    // Doar caile care sunt inca fisiere guvernator sub radacina sunt acceptate: fisierul de stare nu are voie
    // sa devina o cale de a scrie fisiere arbitrare.
    std::set<fs::path> allowed;
    for (const auto& f : governor_files(root)) allowed.insert(f.lexically_normal());

    Result r{true, dry_run ? "Simulare: modul de joc ar fi oprit." : "Modul de joc a fost oprit.", {}};
    std::vector<std::pair<fs::path, std::string>> todo;
    std::string line;
    while (std::getline(in, line)) {
        const auto tab = line.find('\t');
        if (tab == std::string::npos) continue;
        fs::path p = fs::path(line.substr(0, tab)).lexically_normal();
        std::string gov = trim(line.substr(tab + 1));
        if (gov.empty() || !allowed.count(p)) continue;
        todo.emplace_back(std::move(p), std::move(gov));
    }
    in.close();
    for (const auto& [p, g] : todo) r.actions.push_back("scriu " + g + " in " + p.string());
    r.actions.push_back("sterg " + state_file.string());
    if (dry_run) return r;

    std::string err;
    for (const auto& [p, g] : todo)
        if (!write_text(p, g, err)) return fail(err);
    std::error_code ec;
    fs::remove(state_file, ec);
    return r;
}

}  // namespace dominosland::gamemode
