#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/postgresql"
sudo -u postgres pg_dump chatdb > $BACKUP_DIR/chatdb_$DATE.sql
# 7 din se purane backups delete karo
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
echo "Backup done: chatdb_$DATE.sql"
