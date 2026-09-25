import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

function Home() {
  const [claimNumber, setClaimNumber] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    const trimmedClaimNumber = claimNumber.trim();

    if (!trimmedClaimNumber) {
      return;
    }

    navigate(`/track/${encodeURIComponent(trimmedClaimNumber)}`);
  };

  return (
    <main>
      <h1>Seguimiento de entrega</h1>

      <p>
        Ingresá tu número de reclamo para consultar el estado de tu entrega.
      </p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="claimNumber">
          Número de reclamo
        </label>

        <input
          id="claimNumber"
          type="text"
          value={claimNumber}
          onChange={(event) => setClaimNumber(event.target.value)}
          placeholder="Ej. 123456"
        />

        <button type="submit">
          Consultar entrega
        </button>
      </form>
    </main>
  );
}

export default Home;
