#!/bin/bash
set -x
sass --watch scss:css &
python3 -m http.server 8080 &
