# Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex.
cmake_minimum_required(VERSION 3.20)
project(DominosLandEngine CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_library(dlengine STATIC src/gamemode.cpp)
target_include_directories(dlengine PUBLIC include)

add_executable(dl-gamemode src/main.cpp)
target_link_libraries(dl-gamemode PRIVATE dlengine)

enable_testing()
add_executable(gamemode_tests tests/gamemode_tests.cpp)
target_link_libraries(gamemode_tests PRIVATE dlengine)
add_test(NAME gamemode_tests COMMAND gamemode_tests)

if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
  foreach(t dlengine dl-gamemode gamemode_tests)
    target_compile_options(${t} PRIVATE -Wall -Wextra -Wpedantic -Werror)
  endforeach()
endif()

install(TARGETS dl-gamemode RUNTIME DESTINATION bin)
