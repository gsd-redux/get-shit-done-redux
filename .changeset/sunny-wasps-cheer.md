---
type: Fixed
pr: 4615
---
**A hung bounded test check no longer leaks a permanent CPU-pegging orphan process.** `node --test`'s per-file worker subprocess (the process default since Node 22) survived a timed-out check's own kill signal, which only reached the direct runner -- the worker was reparented to PID 1 and could busy-loop forever, consuming a full core, with no visible indication anything was wrong. The bounded check now reaps the whole process tree (POSIX process-group SIGKILL, Windows `taskkill /T /F`) when its own timeout fires. (#3660)
