# Taipei Hackerspace check-in/out server

Central server to communicate with the Arduino hardware,
log check-in and check-out events, and provide an API
for the results.

## Installation

Needs `node-waf` to install dependencies (e.g. `sqlite`), which on
Ubuntu requires the `nodejs-dev` package to be installed:

    sudo apt-get install nodejs-dev