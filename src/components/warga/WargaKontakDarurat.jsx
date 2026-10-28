export default function WargaKontakDarurat({ isEmergencyActive = false }) {
  const emergencyServices = [
    {
      title: 'Ambulans / PSC',
      sub: 'Gawat darurat medis',
      number: '119',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="3" width="15" height="13" />
          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
      ),
    },
    {
      title: 'Pemadam Kebakaran',
      sub: 'Damkar Baureno',
      number: '113',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
        </svg>
      ),
    },
    {
      title: 'Kepolisian',
      sub: 'Polsek Baureno',
      number: '110',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
    },
    {
      title: 'SAR / Basarnas',
      sub: 'Tim perahu & penyelamatan',
      number: '115',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="4" />
          <line x1="4.93" y1="4.93" x2="9.17" y2="9.17" />
          <line x1="14.83" y1="14.83" x2="19.07" y2="19.07" />
          <line x1="14.83" y1="9.17" x2="19.07" y2="4.93" />
          <line x1="4.93" y1="19.07" x2="9.17" y2="14.83" />
        </svg>
      ),
    },
  ]

  const facilities = [
    {
      name: 'Posko Kecamatan Baureno',
      address: 'Jl. Raya Baureno No.10',
      phone: '0353-887788',
    },
    {
      name: 'Posko SDN Baureno 2',
      address: 'Jl. Raya Baureno No.14',
      phone: '0353-887120',
    },
    {
      name: 'Puskesmas Baureno',
      address: 'Jl. Pahlawan No.5',
      phone: '0353-331045',
    },
  ]

  return (
    <div className="warga-kontak-page">
      <span className="kontak-kicker-pill">KONTAK DARURAT</span>
      
      <div className="kontak-page-head">
        <h1>Nomor Penting &amp; Posko Bantuan</h1>
        <p>Hubungi kanal resmi bila Anda membutuhkan pertolongan atau informasi kondisi terkini.</p>
      </div>

      {/* Alert Banner: Emergency Red when isEmergencyActive (matches user screenshot), else Cyan Normal */}
      <div 
        className="kontak-alert-banner"
        style={isEmergencyActive ? {
          background: '#dc2626',
          border: '1px solid #b91c1c',
          color: '#ffffff',
          boxShadow: '0 4px 14px rgba(220, 38, 38, 0.25)',
          fontSize: '0.86rem',
          fontWeight: 700
        } : {}}
      >
        {isEmergencyActive ? (
          <>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" style={{ flexShrink: 0 }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span>
              Dalam kondisi darurat, prioritaskan hubungi 112 atau kirim tiket SOS dari halaman Beranda.
            </span>
          </>
        ) : (
          <>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>
              Semua saluran siaga 24 jam. Dalam kondisi normal, kanal ini siap melayani informasi kesiapsiagaan dan pertanyaan warga.
            </span>
          </>
        )}
      </div>

      {/* 2 Big Hero Cards: BPBD (Teal) and Call Center 112 (Red) */}
      <div className="kontak-hero-grid">
        {/* Card 1: Pusdalops BPBD (Teal) */}
        <div className="kontak-hero-card teal">
          <div className="kontak-hero-info">
            <span className="kontak-hero-sub">Pusdalops BPBD Baureno</span>
            <span className="kontak-hero-phone">0353-881234</span>
            <span className="kontak-hero-note">Komando &amp; evakuasi banjir</span>
          </div>
          <a href="tel:0353881234" className="kontak-call-circle" title="Hubungi Pusdalops BPBD">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </a>
        </div>

        {/* Card 2: 112 Call Center (Red) */}
        <div className="kontak-hero-card red">
          <div className="kontak-hero-info">
            <span className="kontak-hero-sub">Call Center Darurat Nasional</span>
            <span className="kontak-hero-phone">112</span>
            <span className="kontak-hero-note">Bebas pulsa • 24 jam</span>
          </div>
          <a href="tel:112" className="kontak-call-circle" title="Panggil 112">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </a>
        </div>
      </div>

      {/* 2-Column Split Layout */}
      <div className="kontak-bottom-grid">
        {/* Left Column: Layanan Gawat Darurat */}
        <div>
          <h2 className="kontak-subgroup-title">Layanan Gawat Darurat</h2>

          <div className="kontak-services-2x2">
            {emergencyServices.map((srv, idx) => (
              <div key={idx} className="kontak-service-card">
                <div className="kontak-service-left">
                  <div className="kontak-service-icon">{srv.icon}</div>
                  <div className="kontak-service-info">
                    <strong>{srv.title}</strong>
                    <span>{srv.sub}</span>
                  </div>
                </div>
                <div className="kontak-service-num">{srv.number}</div>
              </div>
            ))}
          </div>

          {/* WhatsApp Banner */}
          <div className="kontak-whatsapp-box">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
            <span>
              Laporan warga juga dapat dikirim via WhatsApp Pusdalops:{' '}
              <strong>0812-3456-7890</strong> (khusus pesan, respon lebih cepat saat jam sibuk).
            </span>
          </div>
        </div>

        {/* Right Column: Posko & Fasilitas */}
        <div>
          <h2 className="kontak-subgroup-title">Posko &amp; Fasilitas</h2>

          <div className="kontak-facilities-col">
            {facilities.map((fac, idx) => (
              <div key={idx} className="kontak-facility-card">
                <div className="kontak-facility-top">
                  <strong>{fac.name}</strong>
                </div>
                <div className="kontak-facility-addr">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <span>{fac.address}</span>
                </div>

                <div className="kontak-facility-bottom">
                  <span className="badge-24jam">
                    ● 24 Jam
                  </span>
                  <a href={`tel:${fac.phone.replace(/[^0-9]/g, '')}`} className="kontak-facility-phone">
                    {fac.phone}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
