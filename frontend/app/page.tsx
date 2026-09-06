'use client';

import Link from 'next/link';
import { ChallengeJourney } from '@/components/ChallengeJourney';

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <p className="eyebrow">PropFirm · simulated evaluations</p>
        <h1>Turn your trading skills into income</h1>
        <p className="lead">
          Clear rules. Fast rewards. A FundingPips-style path from challenge to funded account.
        </p>
        <div className="row">
          <a className="btn" href="#journey">
            Buy Evaluation
          </a>
          <Link className="btn secondary" href="/login">
            Trader login
          </Link>
        </div>
        <div className="stats">
          <div>
            <strong>3M+</strong>
            <span>Traders (inspired)</span>
          </div>
          <div>
            <strong>$302M+</strong>
            <span>Rewards narrative</span>
          </div>
          <div>
            <strong>195+</strong>
            <span>Countries</span>
          </div>
        </div>
      </section>

      <div id="journey">
        <ChallengeJourney />
      </div>
    </>
  );
}
