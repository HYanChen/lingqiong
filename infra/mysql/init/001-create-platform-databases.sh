#!/bin/sh
set -eu

NEW_API_DATABASE="new_api"
BOOKSTACK_DATABASE="${BOOKSTACK_DATABASE:-bookstack}"

for identifier in "$MYSQL_DATABASE" "$MYSQL_USER" "$NEW_API_DATABASE" "$BOOKSTACK_DATABASE"; do
  case "$identifier" in
    ""|*[!A-Za-z0-9_]*)
      echo "Invalid MySQL identifier in platform database initialization" >&2
      exit 1
      ;;
  esac
done

mysql --protocol=socket -uroot -p"$MYSQL_ROOT_PASSWORD" <<SQL
CREATE DATABASE IF NOT EXISTS \`$NEW_API_DATABASE\`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS \`$BOOKSTACK_DATABASE\`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON \`$NEW_API_DATABASE\`.* TO '$MYSQL_USER'@'%';
GRANT ALL PRIVILEGES ON \`$BOOKSTACK_DATABASE\`.* TO '$MYSQL_USER'@'%';
GRANT ALL PRIVILEGES ON \`$MYSQL_DATABASE\`.* TO '$MYSQL_USER'@'%';
FLUSH PRIVILEGES;
SQL
