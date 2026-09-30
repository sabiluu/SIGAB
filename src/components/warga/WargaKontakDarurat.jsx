export default function WargaKontakDarurat() {
  const emergencyServices = [
    {
      title: 'Ambulans / PSC',
      sub: 'Gawat darurat medis',
      number: '119',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="1" y="3" width="15" height="13" />
          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
      ),
    },
    {
      title: 'Pemadam Kebakaran',
      sub: 'Damkar Bojonegoro',
      number: '113',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
        </svg>
      ),
    },
    {
      title: 'Kepolisian',
      sub: 'Polsek Baureno',
      number: '110',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
    },
    {
      title: 'SAR / Basarnas',
      sub: 'Tim perahu & penyelamatan',
      number: '115',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
      phone: '0353–887788',
    },
    {
      name: 'Posko SDN Baureno 2',
      address: 'Jl. Raya Baureno No.14',
      phone: '0353–887120',
    },
    {
      name: 'Puskesmas Baureno',
      address: 'Jl. Pahlawan No.5',
      phone: '0353–331045',
    },
  ]

  return (
    <section className="warga-section">
      <div className="warga-section-header">
        <span className="warga-tag-pill blue">Kontak Darurat</span>
        <div className="warga-title-col">
          <h1>Nomor Penting &amp; Posko Bantuan</h1>
          <p>Hubungi kanal resmi bila Anda membutuhkan pertolongan atau informasi kondisi terkini.</p>
        </div>
      </div>

      {/* Info Blue Alert Banner */}
      <div className="kontak-alert-banner">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <span>
          Semua saluran siaga 24 jam. Dalam kondisi normal, kanal ini siap melayani informasi kesiapsiagaan dan
          pertanyaan warga.
        </span>
      </div>

      {/* 2 Big Hero Cards */}
      <div className="kontak-hero-grid">
        {/* Card 1: BPBD Bojonegoro (Blue) */}
        <div className="kontak-hero-card blue">
          <div className="kontak-hero-left">
            <div className="kontak-hero-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
                <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5" />
                <circle cx="12" cy="12" r="2" />
                <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5" />
                <path d="M19.1 4.9C23 8.8 23 15.2 19.1 19.1" />
              </svg>
            </div>
            <div className="kontak-hero-info">
              <span className="kontak-hero-sub">Pusdalops BPBD Bojonegoro</span>
              <span className="kontak-hero-phone">0353–881234</span>
              <span className="kontak-hero-note">Komando &amp; evakuasi banjir</span>
            </div>
          </div>
          <a href="tel:0353881234" className="kontak-call-circle" title="Panggil BPBD">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </a>
        </div>

        {/* Card 2: 112 Call Center (Red) */}
        <div className="kontak-hero-card red">
          <div className="kontak-hero-left">
            <div className="kontak-hero-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </div>
            <div className="kontak-hero-info">
              <span className="kontak-hero-sub">Call Center Darurat Nasional</span>
              <span className="kontak-hero-phone">112</span>
              <span className="kontak-hero-note">Bebas pulsa • 24 jam</span>
            </div>
          </div>
          <a href="tel:112" className="kontak-call-circle" title="Panggil 112">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </a>
        </div>
      </div>

      {/* 2-Column Split Layout */}
      <div className="kontak-split-layout">
        {/* Left Column: Layanan Gawat Darurat */}
        <div className="kontak-col">
          <h3>Layanan Gawat Darurat</h3>

          <div className="kontak-services-grid">
            {emergencyServices.map((srv, idx) => (
              <div key={idx} className="kontak-service-card">
                <div className="kontak-srv-left">
                  <div className="kontak-srv-icon">{srv.icon}</div>
                  <div>
                    <div className="kontak-srv-title">{srv.title}</div>
                    <div className="kontak-srv-sub">{srv.sub}</div>
                  </div>
                </div>
                <div className="kontak-srv-number">{srv.number}</div>
              </div>
            ))}
          </div>

          {/* WhatsApp Banner */}
          <div className="kontak-wa-banner">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
            <span>
              Laporan warga juga dapat dikirim via WhatsApp Pusdalops:{' '}
              <strong>0812–3456–7890</strong> (khusus pesan, respon lebih cepat saat jam sibuk).
            </span>
          </div>
        </div>

        {/* Right Column: Posko & Fasilitas */}
        <div className="kontak-col">
          <h3>Posko &amp; Fasilitas</h3>

          <div className="kontak-posko-list">
            {facilities.map((fac, idx) => (
              <div key={idx} className="kontak-facility-card">
                <div className="kontak-fac-top">
                  <span className="kontak-fac-name">{fac.name}</span>
                  <span className="kontak-fac-addr">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    {fac.address}
                  </span>
                </div>

                <div className="kontak-fac-bottom">
                  <span className="kontak-24h-pill">
                    <span>●</span> 24 Jam
                  </span>
                  <a href={`tel:${fac.phone.replace(/[^0-9]/g, '')}`} className="kontak-fac-phone">
                    {fac.phone}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
