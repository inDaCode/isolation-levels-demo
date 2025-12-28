# Contributing

Thanks for your interest in contributing!

## Development Setup

1. Fork and clone the repo
2. Install dependencies: `pnpm install`
3. Start PostgreSQL: `docker-compose up -d`
4. Run dev servers: `pnpm dev`

## Guidelines

- **Code style:** Format with Prettier before committing
- **Types:** No `any`, use strict TypeScript
- **Commits:** Use conventional commits (`feat:`, `fix:`, `docs:`, etc.)
- **Tests:** Add tests for new features when applicable

## Pull Requests

1. Create a feature branch from `main`
2. Make your changes
3. Ensure `pnpm lint` and `pnpm build` pass
4. Submit PR with clear description

## Found a Bug?

Open an issue with:

- Steps to reproduce
- Expected vs actual behavior
- Browser/Node version

## Questions?

Open a discussion or reach out via issues.
