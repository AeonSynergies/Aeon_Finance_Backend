# Aeon Finance backend

## Organizations, roles & permissions

- Every user, role, job and settings row belongs to an **organization**, and every
  query is filtered by the caller's org (other orgs' records return 404).
- A **role** grants **Read / Write / Edit** per module (`PermissionModule`:
  JOBS, UPLOADS, VALIDATION, APPROVALS, AUDIT, SETTINGS, TEAM). What each action
  allows is defined once in `src/permissions/permissions.catalog.ts` and served at
  `GET /permissions/modules`.
- Routes declare `@RequirePermission(module, action)` and go through
  `PermissionsGuard`. Permissions are loaded from the DB on every request, so
  changes and deactivation take effect immediately.
- The built-in **Admin** role (`isSystem`) has everything and can't be edited or
  deleted. Team rules: you can't grant permissions you don't hold, can't manage
  roles or members with more access than you, can't change your own role,
  permissions or active status, and the org always keeps one active Admin.
- Endpoints: `GET/POST /roles`, `PATCH/DELETE /roles/:id`,
  `GET/POST /team/members`, `PATCH /team/members/:id`, and `GET /auth/me`. Login
  now returns `{ accessToken, user }`.
- Invitations:
  - `GET/POST /team/invitations` and `DELETE /team/invitations/:id` (revoke).
  - Public: `GET /invitations/:token` to preview (404 invalid / used / revoked,
    410 expired) and `POST /invitations/:token/accept` with `{ name, password }`.
    Accepting creates the user with the invited role and returns a session.
  - Tokens are single-use and valid for 7 days, and only their SHA-256 hash is
    stored. Re-inviting an email replaces its pending link. No email is sent: the
    token comes back from `POST` once, for the UI to show as a link.
- Roles created with an org have `isDefault = true`. `isSystem` (Admin) stays
  locked; the other defaults are editable.
- Migrations: `20260928120000_organizations_roles_permissions` moves existing data
  into a "Default Organization". It turns the old ADMIN / MANAGER / EXECUTIVE
  enum into Admin / Manager / Executive roles with the same effective access.
  `20260929090000_invitations` adds invitations and the `isDefault` flag.
  Apply them with `npx prisma migrate deploy`.
- New orgs: `bootstrapOrganization()` in `src/organizations/org-bootstrap.ts`
  creates an org with the default roles; the seed uses it.
- Tests: the service specs run against `DATABASE_URL` (they create and delete
  rows, and the settings spec rewrites settings rows). Point it at a disposable
  database: `DATABASE_URL=postgresql://localhost/aeon_test npx jest`.

---

<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
