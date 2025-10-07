# PolyForge

A modern microservices-based e-commerce platform built with multiple programming languages and technologies, demonstrating a polyglot architecture approach.

## 🏗️ Architecture Overview

PolyForge is designed as a distributed system with the following core services:

- **Order Service** (Python/FastAPI) - Handles order processing and management
- **Catalog Service** (Rust/Axum) - Manages product catalog and inventory data
- **Inventory Service** (Node.js/NestJS) - Tracks product availability and stock levels
- **Recommendation Service** (Python/FastAPI) - Provides personalized product recommendations

## 🛠️ Technology Stack

### Services
- **Order Service**: Python 3.13, FastAPI, PostgreSQL
- **Catalog Service**: Rust 1.83, Axum, MongoDB
- **Inventory Service**: Node.js, NestJS, PostgreSQL
- **Recommendation Service**: Python, FastAPI, MongoDB

### Infrastructure
- **API Gateway**: Kong 3.x with custom plugins (OIDC, Role Checker)
- **Message Broker**: RabbitMQ
- **Caching**: Redis
- **Databases**: PostgreSQL 15, MongoDB 8.0
- **Container Orchestration**: Docker & Docker Compose
- **Build Tool**: Nx Monorepo

### Monitoring & Tools
- **RabbitMQ Management**: RabbitMQ Management UI
- **Kong Admin**: API Gateway administration

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js & npm (for Nx)
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/avetavos/polyforge.git
   cd polyforge
   ```

2. **Install Nx (build tool)**
   ```bash
   npm install -g nx
   # or use npx for individual commands
   ```

3. **Start the infrastructure**
   ```bash
   cd infra
   docker compose --env-file ../.env up -d
   ```

4. **Build and run services**
   ```bash
   # Build all services
   nx run-many --target=build --projects=order-service,catalog-service,inventory-service,recommendation-service

   # Or build individual services
   nx build order-service
   nx build catalog-service
   nx build inventory-service
   nx build recommendation-service
   ```

## 📁 Project Structure

```
polyforge/
├── infra/                          # Infrastructure & DevOps
│   ├── docker-compose.yml         # Main infrastructure stack
│   └── kong/                      # Kong API Gateway configuration
│       ├── dockerfile             # Custom Kong image with plugins
│       └── plugins/               # Custom Kong plugins
├── services/                      # Microservices
│   ├── order-service/            # Python/FastAPI - Order management
│   ├── catalog-service/          # Rust/Axum - Product catalog
│   ├── inventory-service/        # Node.js/NestJS - Inventory tracking
│   └── recommendation-service/   # Python/FastAPI - ML recommendations
├── nx.json                       # Nx workspace configuration
├── .env                         # Environment variables
└── README.md                    # This file
```

## 🔧 Development

### Available Nx Commands

```bash
# Build services
nx build <service-name>
nx build order-service

# Serve services locally (development)
nx serve <service-name>
nx serve catalog-service

# Serve services via Docker
nx serve-docker <service-name>
nx serve-docker order-service

# Build native (without Docker)
nx build-native catalog-service
nx build-native inventory-service

# Infrastructure management
nx up infra              # Start all infrastructure
nx down infra            # Stop all infrastructure
nx databases infra       # Start only databases
```

### Service-Specific Development

#### Order Service (Python/FastAPI)
```bash
cd services/order-service
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

#### Catalog Service (Rust/Axum)
```bash
cd services/catalog-service
cargo run
# Runs on port 8000 by default
```

#### Inventory Service (Node.js/NestJS)
```bash
cd services/inventory-service
npm install
npm run start:dev
```

#### Recommendation Service (Python/FastAPI)
```bash
cd services/recommendation-service
pip install -r requirements.txt
python -m app.main
```

## 🌐 Service Endpoints

| Service | Port | Endpoint | Description |
|---------|------|----------|-------------|
| Kong Gateway | 8000 | http://localhost:8000 | Main API Gateway |
| Kong Admin | 8001 | http://localhost:8001 | Kong Administration |
| Order Service | 8000 | http://localhost:8000 | Order management API |
| Catalog Service | 3000 | http://localhost:3000 | Product catalog API |
| Inventory Service | 4000 | http://localhost:4000 | Inventory tracking API |
| Recommendation Service | 5000 | http://localhost:5000 | Recommendation API |
| RabbitMQ | 15672 | http://localhost:15672 | RabbitMQ Management UI |

## 🗄️ Database Configuration

### PostgreSQL Databases
- **Order Database**: Port 5432
- **Inventory Database**: Port 5433
- **Kong Database**: Port 5434

### MongoDB Databases
- **Catalog Database**: Port 27017
- **Recommendation Database**: Port 27018

### Other Services
- **Redis**: Port 6379
- **RabbitMQ**: Port 5672

## 🔐 Security Features

- **Kong OIDC Plugin**: OpenID Connect authentication
- **Role-based Access Control**: Custom role checker plugin
- **JWT Authentication**: Token-based security
- **SSL/TLS Support**: HTTPS endpoints via Kong

## 📊 Monitoring & Observability

- **Kong Admin API**: Monitor API gateway metrics and health
- **Service Health Checks**: Built-in health endpoints for all services
- **Container Health Checks**: Docker-based health monitoring

## 🧪 Testing

```bash
# Run tests for all services
nx run-many --target=test --all

# Run tests for specific service
nx test order-service
```

## 📝 Environment Variables

Copy `.env.example` to `.env` and configure

## 🚀 Deployment

### Docker Compose (Development)
```bash
cd infra
docker compose --env-file ../.env up -d
```

### Production Deployment
For production deployment, consider:
- Kubernetes manifests
- Helm charts
- CI/CD pipelines
- Environment-specific configurations
- Secrets management
- Load balancing
- Auto-scaling

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📋 Roadmap

- [ ] Add comprehensive test suites
- [ ] Implement circuit breakers
- [ ] Add distributed tracing
- [ ] Implement event sourcing
- [ ] Add GraphQL API gateway
- [ ] Kubernetes deployment manifests
- [ ] CI/CD pipeline setup
- [ ] Performance benchmarking

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Kong for the excellent API Gateway
- The Rust, Node.js, and Python communities
- Docker and container ecosystem
- RabbitMQ for reliable messaging
- All open-source contributors

---

**PolyForge** - Demonstrating the power of polyglot microservices architecture 🚀