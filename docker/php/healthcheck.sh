#!/bin/sh
# ---------------------------------------------------------------------------
#  Toy Store — FastCGI ping probe.
#  Asks the local FPM master to serve /ping through a real worker, which is
#  a far stronger signal than "the process exists". Requires
#  `ping.path = /ping` in the pool (see fpm-pool.conf).
# ---------------------------------------------------------------------------
set -e

SCRIPT_NAME=/ping \
SCRIPT_FILENAME=/ping \
REQUEST_METHOD=GET \
QUERY_STRING= \
cgi-fcgi -bind -connect 127.0.0.1:9000 2>/dev/null | grep -q pong
