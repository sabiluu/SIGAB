import WargaBeranda from './WargaBeranda';

/**
 * WargaPetaWilayah kini digabungkan ke dalam WargaBeranda sebagai satu kesatuan dashboard terpadu.
 * Komponen ini tetap diekspor untuk kompatibilitas dan otomatis mengarahkan scroll ke bagian peta.
 */
export default function WargaPetaWilayah(props) {
  return <WargaBeranda {...props} initialScrollToMap={true} />;
}
