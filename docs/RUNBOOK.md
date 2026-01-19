# Error Scenarios Runbook

This document describes common error scenarios in the FlowViz WMS system and their resolutions.

---

## Authentication Errors (401)

### Symptom

User is redirected to login page unexpectedly.

### Cause

- JWT token expired (30 min default)
- Token was cleared manually
- Page was refreshed (tokens are in-memory only)
- Invalid or tampered token

### Resolution

1. User logs in again
2. For frequent issues, consider implementing refresh tokens (future enhancement)

### Technical Details

- Token is stored in memory (module closure) for XSS protection
- 401 responses trigger automatic redirect to `/login`
- Token is cleared before redirect

---

## Permission Errors (403)

### Symptom

Toast notification: "You do not have permission to perform this action"

### Cause

User's role doesn't have access to the requested resource.

### Resolution

1. Verify user has correct role (ADMIN, MANAGER, OPERATOR, AUDITOR, VIEWER)
2. Contact administrator to update role if needed

### Role Permissions Matrix

| Role | Dashboard | Command | Validator | First Flow | Admin |
|------|:---------:|:-------:|:---------:|:----------:|:-----:|
| VIEWER | View | - | - | View | - |
| OPERATOR | View | Interact | - | Interact | - |
| MANAGER | View | Interact | View | Interact | - |
| AUDITOR | View | - | View | View | - |
| ADMIN | View | Interact | View | Interact | Full |

---

## Server Errors (5xx)

### Symptom

Error boundary with "Server Error" message and retry button.

### Cause

- Backend service unavailable
- Database connection issue
- Unhandled exception in backend
- Memory/CPU exhaustion

### Resolution

1. Check backend logs:
   ```bash
   docker logs flowviz-api
   # or
   cd backend && uv run uvicorn app.main:app --reload
   ```

2. Verify database is running:
   ```bash
   docker ps | grep postgres
   ```

3. Check backend health:
   ```bash
   curl http://localhost:8000/api/health
   ```

4. Check resource usage:
   ```bash
   docker stats
   ```

### Recovery Steps

1. Restart backend service:
   ```bash
   docker restart flowviz-api
   ```

2. If database connection issues, restart database:
   ```bash
   docker restart flowviz-postgres
   ```

3. Clear Redis cache if stale data suspected:
   ```bash
   docker exec flowviz-valkey redis-cli FLUSHALL
   ```

---

## CORS Errors

### Symptom

Browser console: "Access to fetch has been blocked by CORS policy"

### Cause

Frontend origin not in `ALLOWED_ORIGINS` list.

### Resolution

1. Add origin to `ALLOWED_ORIGINS` env variable:
   ```bash
   ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,http://your-new-origin
   ```

2. Restart backend:
   ```bash
   docker restart flowviz-api
   ```

3. Verify CORS headers:
   ```bash
   curl -I -X OPTIONS http://localhost:8000/api/health \
     -H "Origin: http://your-origin" \
     -H "Access-Control-Request-Method: GET"
   ```

### Expected Response Headers

```
Access-Control-Allow-Origin: http://your-origin
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: *
```

---

## Type Generation Issues

### Symptom

`npm run generate:api` fails or produces incorrect types.

### Cause

- Backend not running
- OpenAPI schema has validation errors
- Network connectivity issue

### Resolution

1. Start backend:
   ```bash
   cd backend && uv run uvicorn app.main:app --reload --port 8000
   ```

2. Verify OpenAPI available:
   ```bash
   curl http://localhost:8000/openapi.json | head -100
   ```

3. Run generation:
   ```bash
   cd flow-viz-react && npm run generate:api
   ```

### Troubleshooting

If types are incomplete:
- Check that all routes are included in `api_router`
- Verify Pydantic schemas have proper type annotations
- Check for circular imports in backend

---

## Database Connection Errors

### Symptom

- Backend fails to start
- "Connection refused" errors
- Timeout errors on API calls

### Cause

- PostgreSQL not running
- Incorrect DATABASE_URL
- Network issues between containers

### Resolution

1. Check PostgreSQL status:
   ```bash
   docker ps | grep postgres
   docker logs flowviz-postgres
   ```

2. Verify connection string:
   ```bash
   # Format: postgresql+asyncpg://user:pass@host:port/dbname
   echo $DATABASE_URL
   ```

3. Test connection:
   ```bash
   docker exec -it flowviz-postgres psql -U admin -d flowviz -c "SELECT 1"
   ```

4. Run migrations:
   ```bash
   cd backend && uv run alembic upgrade head
   ```

---

## Memory/Performance Issues

### Symptom

- Slow API responses
- Frontend freezing
- Browser tab crashes

### Cause

- Large datasets being rendered
- Memory leaks
- Inefficient queries

### Resolution

1. Check memory usage:
   ```bash
   docker stats flowviz-api
   ```

2. Enable query logging:
   ```python
   # In backend/app/database.py
   engine = create_async_engine(
       settings.database_url,
       echo=True  # Enable SQL logging
   )
   ```

3. Profile frontend:
   - Use React DevTools Profiler
   - Check TanStack Query Devtools for unnecessary refetches

---

## Production Deployment Failures

### Pre-deployment Checklist

- [ ] All environment variables set
- [ ] SECRET_KEY is secure (32+ chars)
- [ ] DEBUG=false
- [ ] ALLOWED_ORIGINS contains production domain
- [ ] Database migrations applied
- [ ] SSL/TLS certificates configured

### Health Check Endpoints

```bash
# Backend health
curl https://api.flowviz.example.com/api/health

# Expected response
{"status":"ok","timestamp":"2025-01-19T12:00:00Z"}
```

---

## Contact Information

For issues not covered in this runbook:

1. Check the [Architecture Documentation](architecture.md)
2. Review [Environment Variables](ENVIRONMENT.md)
3. Open an issue on GitHub
4. Contact the development team

---

## Related Documentation

- [Environment Variables](ENVIRONMENT.md)
- [Architecture Overview](architecture.md)
- [Setup Guide](SETUP.md)
- [CLAUDE.md](../CLAUDE.md) - AI Coding Guidelines
