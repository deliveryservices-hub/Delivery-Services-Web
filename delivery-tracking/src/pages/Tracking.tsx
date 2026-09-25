import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { supabase } from '../lib/supabase';

import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
} from 'react-leaflet';

type Delivery = {
  id: string;
  claim_number: string;
  status: string;
};

function Tracking() {
  const { claimNumber } = useParams();

  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number | null;
    recorded_at: string;
  } | null>(null);

  useEffect(() => {
    async function loadDelivery() {
      if (!claimNumber) {
        setError('No se indicó un número de reclamo.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');

        const { data, error } = await supabase
          .from('deliveries')
          .select('id, claim_number, status')
          .eq('claim_number', claimNumber)
          .maybeSingle();

        if (error) {
          console.error('Error buscando entrega:', error);
          setError('No se pudo consultar la entrega.');
          return;
        }

        if (!data) {
          setError(
            'No encontramos una entrega con ese número de reclamo.'
          );
          return;
        }

        if (data.status === 'EN_CAMINO') {
          const { data: locationData, error: locationError } =
            await supabase.rpc('get_tracking_location', {
              p_claim_number: claimNumber,
            });

          console.log('Ubicación:', locationData);
          console.log('Error ubicación:', locationError);

          if (locationError) {
            console.error(
              'Error obteniendo ubicación:',
              locationError
            );
          } else if (locationData && locationData.length > 0) {
            setLocation(locationData[0]);
          }
        }

        setDelivery(data);
      } catch (error) {
        console.error('Error buscando entrega:', error);
        setError('Ocurrió un error al consultar la entrega.');
      } finally {
        setLoading(false);
      }
    }

    loadDelivery();
  }, [claimNumber]);

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'PENDIENTE':
        return {
          icon: '🟡',
          title: 'Entrega programada',
          description:
            'Tu entrega todavía no está en reparto.',
        };

      case 'EN_CAMINO':
        return {
          icon: '🔵',
          title: 'En camino',
          description:
            'Tu entrega está siendo trasladada.',
        };

      case 'ENTREGADO':
        return {
          icon: '🟢',
          title: 'Entrega realizada',
          description:
            'La entrega fue realizada correctamente.',
        };

      case 'NO_ENTREGADO':
        return {
          icon: '🔴',
          title: 'Entrega no realizada',
          description:
            'No fue posible completar la entrega.',
        };

      default:
        return {
          icon: '⚪',
          title: 'Estado de entrega',
          description:
            'Estamos procesando la información de tu entrega.',
        };
    }
  };

  if (loading) {
    return (
      <main>
        <h1>Seguimiento de entrega</h1>
        <p>Consultando entrega...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main>
        <h1>Seguimiento de entrega</h1>
        <p>{error}</p>
      </main>
    );
  }

  if (!delivery) {
    return null;
  }

  const statusInfo = getStatusInfo(delivery.status);

  return (
    <main>
      <h1>Seguimiento de entrega</h1>

      <p>
        Reclamo: {delivery.claim_number}
      </p>

      <section>
        <p>
          {statusInfo.icon} {statusInfo.title}
        </p>

        <p>
          {statusInfo.description}
        </p>
      </section>

      {location && (
        <section>
          <h2>Ubicación del vehículo</h2>

          <MapContainer
            center={[location.latitude, location.longitude]}
            zoom={15}
            style={{
              height: '400px',
              width: '100%',
              borderRadius: '12px',
            }}
          >
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <Marker
              position={[location.latitude, location.longitude]}
            >
              <Popup>
                Tu entrega se encuentra en camino.
              </Popup>
            </Marker>
          </MapContainer>

          <p>
            Última actualización:{' '}
            {new Date(location.recorded_at).toLocaleTimeString(
              'es-AR',
              {
                hour: '2-digit',
                minute: '2-digit',
              }
            )}
          </p>
        </section>
      )}
    </main>
  );
}

export default Tracking;
