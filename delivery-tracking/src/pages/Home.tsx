import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';

function Home() {
  const [claimNumber, setClaimNumber] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    const value = claimNumber.trim();

    if (!value) {
      setError('Ingresá tu número de reclamo para continuar.');
      return;
    }

    navigate(`/track/${encodeURIComponent(value)}`);
  };

  return (
    <main className="home-page">
      <section className="label">
        <header className="label-head">
          <img src="/logo.png" alt="Delivery Services" className="label-logo" />
          <span className="label-service">Al servicio de LATAM</span>
        </header>

        <div className="label-body">
          <h1>¿Dónde está tu valija?</h1>
          <p className="label-lead">
            Ingresá tu número de reclamo y seguí la entrega de tu equipaje
            hasta tu domicilio.
          </p>

          <form onSubmit={handleSubmit} noValidate>
            <label htmlFor="claimNumber">Número de reclamo</label>

            <input
              id="claimNumber"
              type="text"
              value={claimNumber}
              onChange={(e) => {
                setClaimNumber(e.target.value.toUpperCase());
                setError('');
              }}
              placeholder="Ej. EZELA12345"
              autoComplete="off"
              autoFocus
              aria-invalid={!!error}
              aria-describedby={error ? 'claim-error' : 'claim-help'}
            />

            {error && (
              <p id="claim-error" className="label-error" role="alert">
                {error}
              </p>
            )}

            <button type="submit">Ver mi valija</button>
          </form>
        </div>

        <div className="label-tear" aria-hidden="true" />

        <footer className="label-stub">
          <p id="claim-help">
            Es el número del reclamo que hiciste por tu equipaje demorado.
          </p>
          <div className="label-barcode" aria-hidden="true" />
        </footer>
      </section>
    </main>
  );
}

export default Home;
