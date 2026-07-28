
### Why you got HTTP `401 Unauthorized` in Swagger

Endpoints under `/api/**` (including `/api/settings`) require an authenticated user. In your screenshot, Swagger sent the request without an `Authorization: Bearer <token>` header, so Spring Security returned `401 Unauthorized`.

---

### Solution Applied

Added an [`OpenApiConfig.java`](file:///c:/Users/PC/Desktop/V2/New%20folder/lms-frontend-backend-springboot/backend/src/main/java/com/lifetrack/config/OpenApiConfig.java) configuration bean to enable JWT Bearer Authentication inside Swagger UI.

---

### How to use Swagger with Authentication

1. **Restart your Spring Boot backend** so it picks up the updated build.
2. **Refresh Swagger UI** (`http://localhost:8080/swagger-ui/index.html`).
3. You will now see a green **"Authorize 🔓"** button at the top right of the page.
4. **Get a JWT Token**:
   - Expand `POST /api/auth/login` (or `register`).
   - Click **Try it out**, fill in your credentials, and click **Execute**.
   - Copy the `token` string from the JSON response body.
5. **Authorize Swagger**:
   - Click the green **Authorize** button at the top right.
   - Paste the JWT token into the **Value** field and click **Authorize**.
6. Now click **Execute** on `PUT /api/settings` or any other protected endpoint — Swagger will automatically include `Authorization: Bearer <token>` and succeed with `200 OK`.