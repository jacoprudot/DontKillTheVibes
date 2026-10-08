@echo off
"C:\Program Files\nodejs\node.exe" "scripts\detect\report.mjs" --target "C:\Users\jfpru\Desktop\proyectos\DontKillTheVibes\benchmark\work\rich" --out "C:\Users\jfpru\Desktop\proyectos\DontKillTheVibes\benchmark\detect-sweep-2026-10-07\runs\rich" > "C:\Users\jfpru\Desktop\proyectos\DontKillTheVibes\benchmark\detect-sweep-2026-10-07\runs\rich\stdout.txt" 2> "C:\Users\jfpru\Desktop\proyectos\DontKillTheVibes\benchmark\detect-sweep-2026-10-07\runs\rich\stderr.txt"
echo %ERRORLEVEL% > "C:\Users\jfpru\Desktop\proyectos\DontKillTheVibes\benchmark\detect-sweep-2026-10-07\runs\rich\exit.txt"
