# AI Chatbot — Multi-VM Infrastructure on Single Ubuntu Machine

> A production-style AI Question Answering web application deployed across 5 KVM virtual machines on a single Ubuntu host using Ollama (local LLM — no API key needed).

---

## Live Architecture

```
User Browser
     |
     v (HTTP port 80)
VM-1: Nginx Reverse Proxy       [192.168.122.11]
     |
     +------------------+
     |                  |
     v                  v
VM-2: React Frontend   VM-3: FastAPI Backend     [192.168.122.12/13]
     (port 3000)              |
                              +----------+
                              |          |
                              v          v
                    VM-4: PostgreSQL   Ollama (phi3)
                    Database           Local LLM
                    [192.168.122.14]   (no API key)

VM-5: Prometheus + Grafana     [192.168.122.15]
      (monitors all VMs)
```

---

## Technology Stack

| Layer | Technology |
|---|---|
| Hypervisor | KVM + QEMU (on single Ubuntu host) |
| Web Server / Reverse Proxy | Nginx |
| Frontend | React (Node.js) |
| Backend API | Python FastAPI |
| AI Model | Ollama — phi3 (local, free, no API key) |
| Database | PostgreSQL 14 |
| Monitoring | Prometheus + Grafana + Node Exporter |
| Process Manager | systemd + pm2 |

---

## Infrastructure Layout

| VM | Role | IP | RAM | Disk |
|---|---|---|---|---|
| VM-1 | Nginx Reverse Proxy | 192.168.122.11 | 512 MB | 5 GB |
| VM-2 | React Frontend | 192.168.122.12 | 1 GB | 6 GB |
| VM-3 | FastAPI Backend + Ollama | 192.168.122.13 | 5 GB | 10 GB |
| VM-4 | PostgreSQL Database | 192.168.122.14 | 1 GB | 5 GB |
| VM-5 | Prometheus + Grafana | 192.168.122.15 | 1 GB | 5 GB |

All VMs run on a single Ubuntu machine using KVM virtualization.  
Total host resources used: ~8.5 GB RAM, ~31 GB disk.

---

## Host Machine Requirements

| Resource | Minimum |
|---|---|
| OS | Ubuntu 22.04 or newer |
| CPU | 4+ cores with VT-x/AMD-V (virtualization) enabled |
| RAM | 12 GB+ |
| Disk | 60 GB+ free |

Check virtualization support:
```bash
grep -Eoc '(vmx|svm)' /proc/cpuinfo
# Must return > 0
```

---

## Project Structure

```
host machine
├── /var/lib/libvirt/images/
│   ├── ubuntu-base.img          # Base cloud image (shared)
│   └── vms/
│       ├── vm1-nginx.qcow2
│       ├── vm2-frontend.qcow2
│       ├── vm3-backend.qcow2
│       ├── vm4-db.qcow2
│       └── vm5-monitoring.qcow2
│
├── VM-1: /etc/nginx/sites-available/chatapp
│
├── VM-2: ~/chatui/
│   ├── src/App.js               # React chat UI
│   └── build/                   # Production build
│
├── VM-3: ~/chatapp/
│   ├── main.py                  # FastAPI app
│   ├── venv/                    # Python virtualenv
│   └── /etc/systemd/system/chatapp.service
│
├── VM-4: PostgreSQL
│   └── chatdb (chatuser)
│       └── messages table
│
└── VM-5: /opt/prometheus/
    └── prometheus.yml
```

---

## Quick Setup Guide

### Step 1 — Install KVM on host

```bash
sudo apt install -y qemu-system-x86 libvirt-daemon-system \
  libvirt-clients bridge-utils virtinst virt-manager \
  cloud-image-utils iptables-persistent

sudo usermod -aG libvirt $USER
sudo usermod -aG kvm $USER
sudo systemctl enable --now libvirtd
newgrp libvirt
```

### Step 2 — Download Ubuntu cloud image

```bash
sudo mkdir -p /var/lib/libvirt/images/vms
cd /tmp
wget https://cloud-images.ubuntu.com/jammy/current/jammy-server-cloudimg-amd64.img
sudo mv jammy-server-cloudimg-amd64.img /var/lib/libvirt/images/ubuntu-base.img
```

### Step 3 — Create all 5 VMs

```bash
sudo create-vm.sh vm1-nginx      192.168.122.11  512  1  5
sudo create-vm.sh vm2-frontend   192.168.122.12  1024 2  6
sudo create-vm.sh vm3-backend    192.168.122.13  5120 4  10
sudo create-vm.sh vm4-db         192.168.122.14  1024 2  5
sudo create-vm.sh vm5-monitoring 192.168.122.15  1024 2  5
```

Default SSH credentials: `ubuntu` / `ubuntu123`

### Step 4 — Configure each VM

| VM | SSH Command | What to install |
|---|---|---|
| VM-1 | `ssh ubuntu@192.168.122.11` | Nginx reverse proxy |
| VM-2 | `ssh ubuntu@192.168.122.12` | Node.js + React + pm2 |
| VM-3 | `ssh ubuntu@192.168.122.13` | FastAPI + Ollama + phi3 |
| VM-4 | `ssh ubuntu@192.168.122.14` | PostgreSQL |
| VM-5 | `ssh ubuntu@192.168.122.15` | Prometheus + Grafana |

### Step 5 — Port forwarding on host

```bash
sudo sysctl -w net.ipv4.ip_forward=1
sudo iptables -t nat -A PREROUTING -p tcp --dport 80 -j DNAT \
  --to-destination 192.168.122.11:80
sudo iptables -t nat -A PREROUTING -p tcp --dport 3001 -j DNAT \
  --to-destination 192.168.122.15:3000
sudo netfilter-persistent save
```

---

## Access the Application

| Service | URL |
|---|---|
| Chat App | http://localhost |
| FastAPI Docs | http://localhost/api/docs |
| Grafana Dashboard | http://192.168.122.15:3000 (admin/admin) |
| Prometheus | http://192.168.122.15:9090 |

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/chat` | Send a message to AI |
| GET | `/history` | Get all chat messages |
| GET | `/health` | Backend health check |
| GET | `/metrics` | Prometheus metrics |

Example:
```bash
curl -X POST http://localhost/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is machine learning?"}'
```

---

## Database Schema

```sql
-- Conversations table
CREATE TABLE conversations (
    id         SERIAL PRIMARY KEY,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Messages table
CREATE TABLE messages (
    id              SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES conversations(id),
    role            TEXT,        -- 'user' or 'assistant'
    content         TEXT,
    created_at      TIMESTAMP DEFAULT NOW()
);
```

---

## Monitoring

Grafana dashboard tracks:
- CPU usage % (all 5 VMs)
- RAM usage % (all 5 VMs)
- Disk usage % (all 5 VMs)
- Network traffic RX/TX
- API requests per second
- VM up/down status

Node Exporter runs on port `9100` on every VM.

---

## Network & Security

### Port Access Matrix

| Source | Destination | Port | Purpose |
|---|---|---|---|
| Users | VM-1 | 80 | Web access |
| VM-1 | VM-2 | 3000 | Frontend |
| VM-1 | VM-3 | 8000 | Backend API |
| VM-3 | VM-4 | 5432 | Database |
| VM-5 | All VMs | 9100 | Node Exporter metrics |

### Firewall (UFW)

Each VM has UFW configured to allow only required traffic:
- VM-1: port 80, 443, 22
- VM-2: port 3000 (from VM-1 only), 22
- VM-3: port 8000 (from VM-1 only), 22
- VM-4: port 5432 (from VM-3 only), 22
- VM-5: port 3000, 9090, 22

---

## Service Management

All services are managed via systemd and auto-start on boot.

```bash
# Check service status
ssh ubuntu@192.168.122.13
sudo systemctl status chatapp
sudo systemctl status ollama

# Restart a service
sudo systemctl restart chatapp

# View live logs
sudo journalctl -u chatapp -f
```

---

## VM Management Commands

```bash
# List all VMs
virsh list --all

# Start / Stop a VM
virsh start vm3-backend
virsh shutdown vm3-backend

# SSH into any VM
ssh ubuntu@192.168.122.11   # VM-1 Nginx
ssh ubuntu@192.168.122.12   # VM-2 Frontend
ssh ubuntu@192.168.122.13   # VM-3 Backend
ssh ubuntu@192.168.122.14   # VM-4 Database
ssh ubuntu@192.168.122.15   # VM-5 Monitoring

# Monitor resource usage
virt-top
```

---

## Database Backup

Automated daily backup runs at 2:00 AM via cron on VM-4:

```bash
# Manual backup
sudo /usr/local/bin/backup-db.sh

# List backups
ls -lh /var/backups/postgresql/

# Restore from backup
sudo -u postgres psql chatdb < /var/backups/postgresql/chatdb_YYYYMMDD.sql
```

---

## Failure Domains

| Component | Failure Impact |
|---|---|
| VM-1 Nginx | App unreachable from browser |
| VM-2 Frontend | UI unavailable |
| VM-3 Backend | AI responses stop |
| VM-4 Database | Chat history not saved |
| VM-5 Monitoring | Loss of observability only |

---

## Future Enhancements

- [ ] HTTPS / SSL via Let's Encrypt on VM-1
- [ ] User authentication (login/signup)
- [ ] Streaming AI responses (WebSocket)
- [ ] Swap Ollama phi3 for larger model (llama3, mistral)
- [ ] Load balancing across multiple backend VMs
- [ ] Centralized log collection (Loki + Grafana)
- [ ] CI/CD pipeline for automated deployments

---

## Author

Built by **Sonu** — deployed on a single Ubuntu machine using KVM virtualization, FastAPI, React, PostgreSQL, and Ollama (local AI — no API key required).
