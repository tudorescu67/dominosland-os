// Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex.
#include <unistd.h>

#include <fstream>
#include <iostream>
#include <sstream>

#include "dominosland/gamemode.hpp"

namespace fs = std::filesystem;
namespace gm = dominosland::gamemode;

static int failures = 0;
#define CHECK(c) do { if (!(c)) { ++failures; std::cerr << __FILE__ << ':' << __LINE__ << ": CHECK esuat: " #c "\n"; } } while (0)

static void put(const fs::path& p, const std::string& s) {
    fs::create_directories(p.parent_path());
    std::ofstream(p) << s << '\n';
}

static std::string get(const fs::path& p) {
    std::ifstream in(p);
    std::string s;
    std::getline(in, s);
    return s;
}

static size_t lines(const fs::path& p) {
    std::ifstream in(p);
    std::string s;
    size_t n = 0;
    while (std::getline(in, s)) ++n;
    return n;
}

int main() {
    const fs::path tmp = fs::temp_directory_path() / ("dl-gamemode-test-" + std::to_string(getpid()));
    fs::remove_all(tmp);
    const fs::path cpu = tmp / "sys/devices/system/cpu";
    const fs::path root = tmp / "sys", state = tmp / "run/gm.state";
    put(cpu / "cpu0/cpufreq/scaling_governor", "powersave");
    put(cpu / "cpu1/cpufreq/scaling_governor", "schedutil");
    put(cpu / "cpu10/cpufreq/scaling_governor", "powersave");
    fs::create_directories(cpu / "cpufreq");
    fs::create_directories(cpu / "cpuidle");

    const auto files = gm::governor_files(root);
    CHECK(files.size() == 3);
    if (files.size() == 3) {
        CHECK(files[0] == cpu / "cpu0/cpufreq/scaling_governor");
        CHECK(files[1] == cpu / "cpu1/cpufreq/scaling_governor");
        CHECK(files[2] == cpu / "cpu10/cpufreq/scaling_governor");
    }
    CHECK(!gm::is_on(root));

    // dry-run nu scrie nimic
    auto r = gm::enable(root, state, true);
    CHECK(r.ok && r.actions.size() == 4 && !fs::exists(state));
    CHECK(get(cpu / "cpu0/cpufreq/scaling_governor") == "powersave");

    r = gm::enable(root, state, false);
    CHECK(r.ok);
    for (const auto& f : files) CHECK(get(f) == "performance");
    CHECK(lines(state) == 3);
    CHECK(gm::is_on(root));

    r = gm::enable(root, state, false);
    CHECK(r.ok && r.actions.empty() && lines(state) == 3);

    // fisier de stare modificat: linia straina trebuie ignorata
    const fs::path evil = tmp / "evil.txt";
    { std::ofstream(state, std::ios::app) << evil.string() << "\tpwned\n"; }
    r = gm::disable(root, state, false);
    CHECK(r.ok);
    CHECK(!fs::exists(evil));
    CHECK(get(cpu / "cpu0/cpufreq/scaling_governor") == "powersave");
    CHECK(get(cpu / "cpu1/cpufreq/scaling_governor") == "schedutil");
    CHECK(get(cpu / "cpu10/cpufreq/scaling_governor") == "powersave");
    CHECK(!fs::exists(state));
    CHECK(!gm::is_on(root));

    r = gm::disable(root, state, false);
    CHECK(r.ok);

    fs::remove_all(tmp);
    if (failures) std::cerr << failures << " verificari esuate\n";
    return failures ? 1 : 0;
}
