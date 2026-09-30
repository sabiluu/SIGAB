export default function WargaPanduan() {
  const guideCards = [
    {
      num: '01',
      stage: 'sebelum',
      stageLabel: 'SEBELUM BANJIR',
      title: 'Siapkan Tas Siaga',
      desc: 'Dokumen penting, obat-obatan, senter, air minum, dan pakaian dalam satu tas mudah dijangkau.',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      ),
    },
    {
      num: '02',
      stage: 'sebelum',
      stageLabel: 'SEBELUM BANJIR',
      title: 'Kenali Jalur Evakuasi',
      desc: 'Pelajari rute menuju posko terdekat di menu Peta Wilayah dan titik kumpul keluarga.',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
    },
    {
      num: '03',
      stage: 'saat',
      stageLabel: 'SAAT BANJIR',
      title: 'Evakuasi ke Dataran Tinggi',
      desc: 'Segera menuju posko saat status Awas. Jangan menerobos arus lebih dari 15 cm.',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="19" x2="12" y2="5" />
          <polyline points="5 12 12 5 19 12" />
        </svg>
      ),
    },
    {
      num: '04',
      stage: 'saat',
      stageLabel: 'SAAT BANJIR',
      title: 'Kirim SOS Bila Terjebak',
      desc: 'Gunakan tombol SOS untuk mengirim lokasi GPS. Tetap di tempat tinggi & terlihat.',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
      ),
    },
    {
      num: '05',
      stage: 'saat',
      stageLabel: 'SAAT BANJIR',
      title: 'Prioritaskan Kelompok Rentan',
      desc: 'Dahulukan lansia, balita, ibu hamil, dan penyandang disabilitas saat evakuasi.',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      ),
    },
    {
      num: '06',
      stage: 'sesudah',
      stageLabel: 'SESUDAH BANJIR',
      title: 'Pastikan Rumah Aman',
      desc: 'Cek instalasi listrik & gas sebelum masuk. Bersihkan lumpur dan cegah penyakit.',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
    },
  ]

  const tasItems = [
    'Dokumen penting (KTP, KK) dalam plastik kedap air',
    'Obat pribadi & kotak P3K',
    'Air minum & makanan tahan lama 3 hari',
    'Senter + baterai cadangan / power bank',
    'Peluit untuk memberi sinyal',
    'Pakaian ganti & jas hujan',
  ]

  return (
    <section className="warga-section">
      {/* Top Green Alert Banner */}
      <div className="panduan-alert-banner">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <polyline points="9 12 11 14 15 10" />
        </svg>
        <span>
          <strong>Status AMAN aktif</strong> — Tetap siaga dan pelajari langkah kesiapsiagaan di bawah ini sebagai
          tindakan pencegahan dini.
        </span>
      </div>

      <div className="warga-section-header">
        <span className="warga-tag-pill blue">Panduan</span>
        <div className="warga-title-col">
          <h1>Panduan Kesiapsiagaan Banjir</h1>
          <p>Langkah praktis melindungi diri &amp; keluarga — sebelum, saat, dan sesudah banjir.</p>
        </div>
      </div>

      <div className="panduan-layout">
        {/* Left Column: 6 Guide Cards */}
        <div className="panduan-cards-grid">
          {guideCards.map((card) => (
            <div key={card.num} className="panduan-card">
              <span className="panduan-watermark-num">{card.num}</span>
              <div className="panduan-icon-box">{card.icon}</div>
              <span className={`panduan-stage-pill ${card.stage}`}>{card.stageLabel}</span>
              <h3>{card.title}</h3>
              <p>{card.desc}</p>
            </div>
          ))}
        </div>

        {/* Right Column: Tas Siaga & Status Explainer */}
        <div className="panduan-sidebar">
          {/* Card 1: Blue Tas Siaga Bencana */}
          <div className="panduan-tas-card">
            <div className="panduan-tas-sub">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
              <span>Tas Siaga Bencana</span>
            </div>
            <h3>Barang wajib yang harus siap sebelum musim penghujan tiba.</h3>

            <div className="panduan-tas-list">
              {tasItems.map((item, idx) => (
                <div key={idx} className="panduan-tas-item">
                  <span className="chevron">›</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Card 2: White Status Explanation Card */}
          <div className="panduan-status-card">
            <h4>Kenali Tingkat Status</h4>
            <div className="panduan-status-list">
              <div className="panduan-status-box">
                <div className="panduan-sb-title" style={{ color: '#059669' }}>
                  <span>●</span> Aman
                </div>
                <div className="panduan-sb-desc">Beraktivitas normal, tetap pantau info.</div>
              </div>

              <div className="panduan-status-box">
                <div className="panduan-sb-title" style={{ color: '#d97706' }}>
                  <span>●</span> Siaga
                </div>
                <div className="panduan-sb-desc">Waspada, siapkan tas siaga &amp; pantau air.</div>
              </div>

              <div className="panduan-status-box">
                <div className="panduan-sb-title" style={{ color: '#dc2626' }}>
                  <span>●</span> Awas
                </div>
                <div className="panduan-sb-desc">Evakuasi segera ke posko terdekat.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
