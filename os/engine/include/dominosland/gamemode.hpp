// Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex.
#pragma once

#include <filesystem>
#include <string>
#include <vector>

namespace dominosland::gamemode {

struct Result {
    bool ok = false;
    std::string message;
    std::vector<std::string> actions;
};

// Radacina si fisierul de stare sunt parametri ca testele sa ruleze intr-un director temporar.
inline const std::filesystem::path kDefaultRoot = "/sys";
inline const std::filesystem::path kDefaultStateFile = "/run/dominosland/gamemode.state";

std::vector<std::filesystem::path> governor_files(const std::filesystem::path& root = kDefaultRoot);
bool is_on(const std::filesystem::path& root = kDefaultRoot);
Result enable(const std::filesystem::path& root, const std::filesystem::path& state_file, bool dry_run);
Result disable(const std::filesystem::path& root, const std::filesystem::path& state_file, bool dry_run);

}  // namespace dominosland::gamemode
