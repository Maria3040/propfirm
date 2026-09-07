import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-graphql-lab-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="app-stub" style="max-width: 720px">
      <p class="meta"><a routerLink="/accounts">← Accounts</a></p>
      <h1>GraphQL lab</h1>
      <p class="lead">
        GraphQL is available on the Nest track only (NestJS GraphQL + TypeORM + Postgres · Next.js Apollo Client).
        This Angular frontend uses the REST API via <code>ApiService</code>.
      </p>
      <p class="meta">
        Playground (when Nest API is running):
        <a href="http://localhost:6080/graphql" target="_blank" rel="noreferrer">/graphql</a>
      </p>
    </div>
  `,
})
export class GraphqlLabPage {}
