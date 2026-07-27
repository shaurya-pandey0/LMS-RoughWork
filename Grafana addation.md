Quick correction: Grafana itself isn't a Maven dependency — it's a separate server (like Mongo). The pom.xml part is Actuator + Micrometer's Prometheus registry; Grafana + Prometheus run alongside as their own processes. I'll wire all three.

Adding Actuator + Micrometer Prometheus registry to pom.xml, exposing endpoints in application.yml, then Prometheus + Grafana as Docker containers (no install needed) scraping/visualizing it.

Now Prometheus (scrapes Spring's metrics) and Grafana (visualizes them), as Docker containers alongside your existing services — no manual install needed if Docker Desktop is present.

Verifying the backend still compiles with the new dependencies:

I ran that offline earlier by habit — needs to hit the network to fetch the two new jars once, then it'll cache locally.

Downloaded and BUILD SUCCESS. Everything's in place.

**What I changed:**
- `backend/pom.xml` — added `spring-boot-starter-actuator` and `micrometer-registry-prometheus`.
- `backend/src/main/resources/application.yml` — exposed `/actuator/health`, `/actuator/metrics`, `/actuator/prometheus`.
- `monitoring/prometheus.yml` + `monitoring/docker-compose.yml` — Prometheus scrapes your backend every 5s, Grafana visualizes it. Both run as Docker containers, no manual install.

**To see it:**
1. Start your backend as usual (`mvnw spring-boot:run` or via `start-lifetrack.bat`).
2. `docker compose up -d` inside the `monitoring` folder (needs Docker Desktop installed).
3. Open `http://localhost:3000` (Grafana, login `admin`/`admin`) → Add data source → Prometheus → URL `http://prometheus:9090` → Save.
4. Import a ready-made dashboard: "+" → Import → dashboard ID **4701** ("JVM (Micrometer)") — instant graphs for HTTP request rate, latency, JVM memory, GC, thread count, per every request your backend handles.

Hit a few of your API endpoints (login, expenses, journal) and watch the request-rate graph move live — that's your "visual representation for every request."

One thing to flag: `/actuator/prometheus` is currently open with no auth, same as Swagger. Fine for a local demo; don't expose it publicly as-is.


---
I can start Docker Desktop for you, but I can't click through its GUI startup, so I need to launch it and then poll until the engine responds.

Launched. Docker Desktop's engine takes 30-90 seconds to come up on first start — polling now.

Docker engine is up. Now starting Prometheus + Grafana.

Both containers are up: `lifetrack-prometheus` and `lifetrack-grafana` started successfully. Confirming they're actually running (not crash-looping) and Prometheus can see your backend.

Both are up and running:

- **Prometheus**: `http://localhost:9090`
- **Grafana**: `http://localhost:3000` (login `admin` / `admin`)

Note: Prometheus can only actually scrape metrics once your Spring Boot backend is running on port 8080 (with the actuator dependency we added earlier). If the backend isn't up right now, Prometheus will just show the target as "down" until you start it — that's expected, not an error.

Next steps in Grafana:
1. Go to `http://localhost:3000`, log in with `admin`/`admin`.
2. Add a data source → Prometheus → URL `http://prometheus:9090` (use the container name, not `localhost`, since Grafana is querying from inside its own container).
3. Dashboards → Import → dashboard ID **4701** → select your Prometheus data source → Import.

Once your backend is running and you hit a few endpoints, that dashboard will show live request-rate, latency, and JVM graphs.