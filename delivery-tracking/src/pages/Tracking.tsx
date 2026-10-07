import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { supabase } from '../lib/supabase';

import './Tracking.css';

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
  route_id: string | null;
  eta_window_start: string | null;
  eta_window_end: string | null;
};

type Route = {
  id: string;
  date: string;
  status: string;
  started_at: string | null;
};

type StatusHistory = {
  status: string;
  changed_at: string;
  failure_reason: string | null;
};

type LocationData = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  recorded_at: string;
};

function Tracking() {
  const { claimNumber } = useParams();
  const navigate = useNavigate();

  const [delivery, setDelivery] = useState<Delivery | null>(
    null
  );

  const [route, setRoute] = useState<Route | null>(null);

  const [statusHistory, setStatusHistory] = useState<
    StatusHistory[]
  >([]);

  const [location, setLocation] =
    useState<LocationData | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const getTodayString = () => {
    const today = new Date();

    const year = today.getFullYear();
    const month = String(
      today.getMonth() + 1
    ).padStart(2, '0');
    const day = String(
      today.getDate()
    ).padStart(2, '0');

    return `${year}-${month}-${day}`;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString(
      'es-AR',
      {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }
    );
  };

  const formatTime = (date: string | null) => {
    if (!date) return null;

    return new Date(date).toLocaleTimeString(
      'es-AR',
      {
        hour: '2-digit',
        minute: '2-digit',
      }
    );
  };

  const getETA = () => {
    if (!delivery?.eta_window_start) {
      return null;
    }

    const start = formatTime(
      delivery.eta_window_start
    );

    const end = formatTime(
      delivery.eta_window_end
    );

    if (!start) {
      return null;
    }

    return {
      start,
      end,
    };
  };

  const loadDelivery = useCallback(

    async (showLoading = true) => {
      if (!claimNumber) return;

      const normalizedClaimNumber =
        claimNumber.toUpperCase().trim();

      try {
        if (showLoading) {
          setLoading(true);
        }

        setError('');

        // ----------------------------------------------
        // Entrega
        // ----------------------------------------------

        const {
          data,
          error: deliveryError,
        } = await supabase
          .from('deliveries')
          .select(`
            id,
            claim_number,
            status,
            route_id,
            eta_window_start,
            eta_window_end
          `)
          .eq(
            'claim_number',
            normalizedClaimNumber
          );

        if (deliveryError) {
          console.error(
            'Error buscando entrega:',
            deliveryError
          );

          setError(
            'No se pudo consultar la entrega.'
          );

          return;
        }

        if (!data || data.length === 0) {
          setError(
            'No encontramos una entrega con ese número de reclamo.'
          );

          return;
        }

        const currentDelivery =
          data[0] as Delivery;

        setDelivery(currentDelivery);

        // ----------------------------------------------
        // Recorrido
        // ----------------------------------------------

        let currentRoute: Route | null = null;

        const {
          data: routeData,
          error: routeError,
        } = await supabase.rpc(
          'get_tracking_route',
          {
            p_claim_number:
              normalizedClaimNumber,
          },
        );

        const routes =
          (routeData ?? []) as Route[];

        if (routeError) {
          console.error(
            'Error obteniendo recorrido:',
            routeError
          );
        } else if (routes.length > 0) {
          currentRoute = routes[0];

          console.log(
            '🛣️ Recorrido obtenido:',
            currentRoute
          );

          setRoute(currentRoute);
        } else {
          setRoute(null);
        }

        // ----------------------------------------------
        // Historial
        // ----------------------------------------------

        const {
          data: historyData,
          error: historyError,
        } = await supabase.rpc(
          'get_tracking_history',
          {
            p_claim_number:
              normalizedClaimNumber,
          }
        );

        if (historyError) {
          console.error(
            'Error obteniendo historial:',
            historyError
          );

          setStatusHistory([]);
        } else if (historyData) {
          setStatusHistory(historyData);
        } else {
          setStatusHistory([]);
        }

        // ----------------------------------------------
        // Ubicación del vehículo
        // Solo si el recorrido está EN_CURSO
        // ----------------------------------------------

        if (
          currentRoute?.status ===
          'EN_CURSO'
        ) {
          const {
            data: locationData,
            error: locationError,
          } = await supabase.rpc(
            'get_tracking_location',
            {
              p_claim_number:
                normalizedClaimNumber,
            }
          );

          if (locationError) {
            console.error(
              'Error obteniendo ubicación:',
              locationError
            );

            setLocation(null);
          } else if (
            locationData &&
            locationData.length > 0
          ) {
            setLocation(locationData[0]);
          } else {
            setLocation(null);
          }
        } else {
          // Si el recorrido ya no está en curso,
          // no mostramos una ubicación vieja.
          setLocation(null);
        }
      } catch (error) {
        console.error(
          'Error buscando entrega:',
          error
        );

        setError(
          'Ocurrió un error al consultar la entrega.'
        );
      } finally {
        if (showLoading) {
          setLoading(false);
        }
      }
    },
    [claimNumber]
  );

  useEffect(() => {
    if (!claimNumber) {
      return;
    }

    let isMounted = true;

    const normalizedClaimNumber =
      claimNumber.toUpperCase().trim();

    const channel = supabase
      .channel(
        `tracking:${normalizedClaimNumber}`
      )
      .on(
        'broadcast',
        {
          event: 'LOCATION_UPDATE',
        },
        (payload) => {
          console.log(
            '📍 Nueva ubicación recibida:',
            payload
          );

          const newLocation =
            payload.payload as LocationData;

          if (isMounted) {
            setLocation(newLocation);
          }
        }
      )
      .subscribe((status) => {
        console.log(
          '🔌 Estado Broadcast:',
          status
        );
      });

    // Carga inicial.
    // Ya NO tenemos intervalo de 30 segundos.
    const timeoutId = window.setTimeout(() => {
      loadDelivery();
    }, 0);

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
      supabase.removeChannel(channel);
    };
  }, [claimNumber, loadDelivery]);

  const handleRefresh = async () => {
    setRefreshing(true);

    try {
      // false = no mostrar la pantalla completa
      // de loading mientras actualizamos.
      await loadDelivery(false);
    } finally {
      setRefreshing(false);
    }
  };

  const getCurrentStatus = () => {
    if (!delivery) {
      return null;
    }

    // Entrega finalizada correctamente
    if (delivery.status === 'ENTREGADO') {
      return {
        type: 'success',
        icon: '✓',
        label: 'Entrega realizada',
        description:
          'Tu entrega fue realizada correctamente.',
      };
    }

    // Entrega no realizada
    if (delivery.status === 'NO_ENTREGADO') {
      return {
        type: 'error',
        icon: '×',
        label: 'Entrega no realizada',
        description:
          'No fue posible completar la entrega.',
      };
    }

    if (!route) {
      return null;
    }

    const today = getTodayString();

    // Recorrido de hoy en curso
    if (
      route.date === today &&
      route.status === 'EN_CURSO'
    ) {
      return {
        type: 'progress',
        icon: '→',
        label: 'Tu entrega está en camino',
        description:
          'El chofer ya inició el recorrido y está realizando las entregas.',
      };
    }

    // Recorrido de hoy pendiente
    if (
      route.date === today &&
      route.status === 'PENDIENTE'
    ) {
      return {
        type: 'pending',
        icon: '○',
        label: 'Entrega programada',
        description:
          'Tu entrega está programada para hoy. El recorrido todavía no comenzó.',
      };
    }

    // Recorrido futuro
    if (route.date > today) {
      return {
        type: 'pending',
        icon: '○',
        label: 'Entrega programada',
        description: `Tu entrega está programada para el ${formatDate(
          route.date
        )}.`,
      };
    }

    // Recorrido completado
    if (route.status === 'COMPLETADO') {
      return {
        type: 'success',
        icon: '✓',
        label: 'Recorrido finalizado',
        description:
          'El recorrido correspondiente a tu entrega ya finalizó.',
      };
    }

    return null;
  };

  const getHistoryInfo = (
    status: string
  ) => {
    switch (status) {
      case 'PENDIENTE':
        return {
          icon: '○',
          title: 'Entrega programada',
          description:
            'Tu entrega está preparada para ser realizada.',
        };

      case 'EN_CAMINO':
        return {
          icon: '→',
          title: 'Reparto iniciado',
          description:
            'El chofer inició el recorrido y está realizando las entregas.',
        };

      case 'ENTREGADO':
        return {
          icon: '✓',
          title: 'Entrega realizada',
          description:
            'La entrega fue realizada correctamente.',
        };

      case 'NO_ENTREGADO':
        return {
          icon: '×',
          title: 'Entrega no realizada',
          description:
            'No fue posible completar la entrega.',
        };

      default:
        return {
          icon: '○',
          title: 'Actualización',
          description: '',
        };
    }
  };

  if (loading) {
    return (
      <main className="tracking-state-page">
        <section className="tracking-state-card">
          <div className="tracking-loading-spinner">
            <span />
          </div>

          <h1>Seguimiento de entrega</h1>

          <p>
            Consultando entrega...
          </p>
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main className="tracking-state-page">
        <section className="tracking-state-card">
          <div className="tracking-error-icon">
            ×
          </div>

          <h1>Seguimiento de entrega</h1>

          <p>
            {error}
          </p>

          <button
            type="button"
            className="tracking-state-button"
            onClick={() => navigate('/')}
          >
            Volver
          </button>
        </section>
      </main>
    );
  }

  if (!delivery) {
    return null;
  }

  const currentStatus = getCurrentStatus();

  if (!currentStatus) {
    return null;
  }

  const today = getTodayString();

  const isToday =
    route?.date === today;

  const isRouteInProgress =
    isToday &&
    route?.status === 'EN_CURSO';

  const isFinished =
    delivery.status === 'ENTREGADO' ||
    delivery.status === 'NO_ENTREGADO';

  const eta = getETA();

  const showMap =
    isRouteInProgress &&
    !isFinished &&
    location !== null;


  const displayedHistory = [
    ...statusHistory,
  ];

  // Si el recorrido está EN_CURSO pero por alguna
  // razón todavía no existe el evento EN_CAMINO
  // en el historial, lo agregamos usando started_at.
  if (
    isRouteInProgress &&
    route?.started_at &&
    !statusHistory.some(
      (item) => item.status === 'EN_CAMINO'
    )
  ) {
    displayedHistory.push({
      status: 'EN_CAMINO',
      changed_at: route.started_at,
      failure_reason: null,
    });
  }

  const addMinutesToTime = (time: string, minutes: number) => {
    const [hours, mins] = time.split(':').map(Number);

    const date = new Date();
    date.setHours(hours, mins, 0, 0);
    date.setMinutes(date.getMinutes() + minutes);

    return date.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  return (
    <main className="tracking-page">
      <div className="tracking-container">

        {/* ==================================================
            HEADER
        ================================================== */}

        <header className="tracking-header">
          <img
            src="/logo.png"
            alt="Delivery Services"
            className="tracking-logo"
          />

          <p className="tracking-service">
            Al servicio de LATAM
          </p>

          <h1>
            Seguimiento de entrega
          </h1>

          <p className="tracking-claim">
            Reclamo:{' '}
            <strong>
              {delivery.claim_number}
            </strong>
          </p>
        </header>

        {/* ==================================================
            ESTADO ACTUAL
        ================================================== */}

        <section
          className={`tracking-current-status tracking-current-${currentStatus.type}`}
        >
          <div className="tracking-current-icon">
            {currentStatus.type ===
              'success' && '✓'}

            {currentStatus.type ===
              'error' && '!'}

            {currentStatus.type ===
              'progress' && '→'}

            {currentStatus.type ===
              'pending' && '•'}

            {currentStatus.type ===
              'default' && '•'}
          </div>

          <div className="tracking-current-content">
            <p className="tracking-current-label">
              {currentStatus.label}
            </p>

            <h2>
              {currentStatus.label}
            </h2>

            <p className="tracking-current-description">
              {currentStatus.description}
            </p>

            {/* ETA solamente para recorrido
                de HOY que está EN_CURSO */}

            {isRouteInProgress &&
              !isFinished &&
              eta && (
                <div className="tracking-eta">
                  <div>
                    <span className="tracking-eta-label">
                      Llegada estimada
                    </span>

                    <strong>
                      {eta.start} — {addMinutesToTime(eta.start, 15)}
                    </strong>
                  </div>

                  <span className="tracking-eta-note">
                    Horario estimado
                  </span>
                </div>
            )}

            {isToday && !isFinished && (
              <button
                type="button"
                className="tracking-refresh-button"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <span
                  className={
                    refreshing
                      ? 'tracking-refresh-icon tracking-refresh-spinning'
                      : 'tracking-refresh-icon'
                  }
                >
                  ↻
                </span>

                {refreshing
                  ? 'Actualizando...'
                  : 'Actualizar seguimiento'}
              </button>
            )}

            {isRouteInProgress &&
              !isFinished &&
              !eta && (
                <div className="tracking-eta tracking-eta-unavailable">
                  <div>
                    <span className="tracking-eta-label">
                      Llegada estimada
                    </span>

                    <strong>
                      En reparto
                    </strong>
                  </div>
                </div>
              )}
          </div>
        </section>

        {/* ==================================================
            SEGUIMIENTO
        ================================================== */}

        <section className="tracking-history">
          <h2 className="tracking-section-title">
            Seguimiento
          </h2>

          <div className="timeline">

            {statusHistory.map(
              (item, index) => {
                const info =
                  getHistoryInfo(
                    item.status
                  );

                const isCurrent =
                  index ===
                  statusHistory.length - 1;

                return (
                  <div
                    className={`timeline-item ${
                      isCurrent
                        ? 'timeline-item-current'
                        : ''
                    }`}
                    key={`${item.status}-${item.changed_at}-${index}`}
                  >
                    <div className="timeline-indicator">
                      <div className="timeline-dot">
                        {item.status ===
                          'ENTREGADO' &&
                          '✓'}

                        {item.status ===
                          'NO_ENTREGADO' &&
                          '×'}
                      </div>

                      {index <
                        statusHistory.length -
                          1 && (
                        <div className="timeline-line" />
                      )}
                    </div>

                    <div className="timeline-content">
                      <p className="timeline-title">
                        {info.title}
                      </p>

                      <span className="timeline-date">
                        {new Date(
                          item.changed_at
                        ).toLocaleString(
                          'es-AR',
                          {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          }
                        )}
                      </span>

                      {isCurrent && (
                        <p className="timeline-description">
                          {info.description}
                        </p>
                      )}

                      {item.status ===
                        'NO_ENTREGADO' &&
                        item.failure_reason && (
                          <div className="timeline-failure">
                            <strong>
                              Motivo:
                            </strong>{' '}
                            {
                              item.failure_reason
                            }
                          </div>
                        )}
                    </div>
                  </div>
                );
              }
            )}

            {/* Si el recorrido ya comenzó,
                agregamos el evento de inicio
                aunque la entrega siga PENDIENTE. */}

            {isRouteInProgress &&
              route?.started_at &&
              !statusHistory.some(
                (item) =>
                  item.status ===
                  'EN_CAMINO'
              ) && (
                <div className="timeline-item">
                  <div className="timeline-indicator">
                    <div className="timeline-dot">
                      →
                    </div>
                  </div>

                  <div className="timeline-content">
                    <p className="timeline-title">
                      Reparto iniciado
                    </p>

                    <span className="timeline-date">
                      {new Date(
                        route.started_at
                      ).toLocaleString(
                        'es-AR',
                        {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        }
                      )}
                    </span>

                    <p className="timeline-description">
                      El chofer inició el recorrido
                      y está realizando las entregas.
                    </p>
                  </div>
                </div>
              )}

          </div>
        </section>

        {/* ==================================================
            MAPA
        ================================================== */}

        {showMap && location && (
          <section className="tracking-map-section">
            <div className="tracking-map-heading">
              <div>
                <h2 className="tracking-section-title">
                  Ubicación del vehículo
                </h2>

                <p>
                  El vehículo se encuentra
                  realizando el recorrido.
                </p>
              </div>

              <span className="tracking-live-badge">
                ● En vivo
              </span>
            </div>

            <div className="tracking-map">
              <MapContainer
                center={[
                  location.latitude,
                  location.longitude,
                ]}
                zoom={15}
                scrollWheelZoom={false}
                style={{
                  height: '100%',
                  width: '100%',
                }}
              >
                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <Marker
                  position={[
                    location.latitude,
                    location.longitude,
                  ]}
                >
                  <Popup>
                    El vehículo se encuentra
                    realizando el recorrido.
                  </Popup>
                </Marker>
              </MapContainer>
            </div>

            <p className="tracking-last-update">
              Última actualización:{' '}
              {new Date(
                location.recorded_at
              ).toLocaleTimeString(
                'es-AR',
                {
                  hour: '2-digit',
                  minute: '2-digit',
                }
              )}
            </p>
          </section>
        )}

        {/* ==================================================
            RECORRIDO EN CURSO PERO SIN UBICACIÓN
        ================================================== */}

        {isRouteInProgress &&
          !isFinished &&
          !location && (
            <section className="tracking-map-section">
              <div className="tracking-location-pending">
                <div className="tracking-location-icon">
                  ●
                </div>

                <div>
                  <strong>
                    El recorrido está en curso
                  </strong>

                  <p>
                    La ubicación del vehículo
                    todavía no está disponible. La mostraremos cuando su entrega sea la siguiente.
                  </p>
                </div>
              </div>
            </section>
          )}

        <div className="tracking-footer">
          <button
            type="button"
            className="tracking-home-button"
            onClick={() => navigate('/')}
          >
            ← Volver al inicio
          </button>
        </div>

      </div>
    </main>
  );
}

export default Tracking;
