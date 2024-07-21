#!/bin/sh

bold=$(tput bold)
italic=$(tput italic)
normal=$(tput sgr0)

DOMAIN=dev.zoneblitz.app
CERT_PATH=".devcontainer/certs/${DOMAIN}"
CERT_FILE="${CERT_PATH}.cert"
KEY_FILE="${CERT_PATH}.key"
HOST_ENTRY="127.0.0.1\t${DOMAIN}\n::1             ${DOMAIN}\n"

echo "🏈 ${bold}Initializing development environment for Zone Blitz!${normal}\n"

echo "🌐 ${bold}Generating SSL and HTTPS certificates for development container environment...\n${normal}"
if [ -f "${CERT_FILE}" ]; then
  echo "Certification was already created. Skipping certification creation and proceeding with dev container creation.\n"
else
  echo "Certification does not exist already for dev container. Proceeding to create certifications."

  if [ -n "${CI}" ]; then
    echo "In a CI environment, automatically installing mkcert."
    sudo apt install libnss3-tools
    curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64"
    chmod +x mkcert-v*-linux-amd64
    sudo mv mkcert-v*-linux-amd64 /usr/local/bin/mkcert
  fi

  echo "You ${italic}may${normal} need to require sudo access. This is because mkcert will trust the generated certificate for you to avoid browser issues.\n"
  echo "Please provide the sudo password, ${bold}otherwise you can run mkcert manually outside of this script with the following command:${normal}\n\n"
  echo "${bold}mkcert -install\nmkcert -cert-file ${CERT_FILE} -key-file ${KEY_FILE} ${DOMAIN}\n${normal}"

  if mkcert -install && mkcert -cert-file "${CERT_FILE}" -key-file "${KEY_FILE}" "${DOMAIN}"; then
    echo "Certification was generated for ${DOMAIN}. Proceeding with rest of initialization of the development container."
  else
    echo "mkcert failed to install. You may need to install mkcert, see https://github.com/FiloSottile/mkcert?tab=readme-ov-file#installation for installation instructions."
  fi
fi

echo "📝 ${bold}Adding custom host ${DOMAIN} for development container environment...\n${normal}"
if grep -q "$DOMAIN" /etc/hosts; then
  echo "${DOMAIN} already exists in /etc/hosts. Skipping automated host resolution setup.\n"
else
  echo "${DOMAIN} does not exist in /etc/hosts. Proceeding with adding this host to your /etc/hosts file.\n"
  echo "Adding the host requires sudo permissions. You may need to provide your sudo password below.\n${bold}If you do not feel comfortable with this, you can manually add the following hosts to your /etc/hosts file:${normal}\n"
  echo "${HOST_ENTRY}"
  echo "${HOST_ENTRY}" | sudo tee -a /etc/hosts > /dev/null
  echo "Automatically added ${DOMAIN} to your hosts file.\n"
fi
