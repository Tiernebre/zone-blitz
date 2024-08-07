#!/bin/bash

ZONE_BLITZ_DOMAIN=dev.zoneblitz.app
echo "🌐 Adding $ZONE_BLITZ_DOMAIN proxy route to hosts file."

DOMAIN=proxy
IP=$(dig +short $DOMAIN)
HOST_ENTRY="$IP $ZONE_BLITZ_DOMAIN"

if grep -q "$ZONE_BLITZ_DOMAIN" /etc/hosts; then
  echo "$ZONE_BLITZ_DOMAIN already exists in /etc/hosts. Skipping."
else
  echo "Adding $HOST_ENTRY to /etc/hosts"
  echo "${HOST_ENTRY}" | sudo tee -a /etc/hosts > /dev/null
  echo "Added ${HOST_ENTRY} to /etc/hosts"
fi
