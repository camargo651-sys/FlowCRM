#!/bin/bash
cd /Users/andres/Projects/Tracktio
while true; do
  npm run dev 2>&1 | tee /tmp/flowcrm-server.log
  echo "Server crashed, restarting in 2 seconds..."
  sleep 2
done
