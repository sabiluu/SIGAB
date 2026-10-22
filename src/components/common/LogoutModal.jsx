export default function LogoutModal({ isOpen, onClose, onConfirm }) {
  if (!isOpen) return null

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(12, 26, 36, 0.65)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          background: '#ffffff',
          borderRadius: '20px',
          maxWidth: '440px',
          width: '100%',
          padding: '36px 32px 28px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          position: 'relative',
          textAlign: 'center'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '18px',
            right: '18px',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: '#f1f5f9',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            transition: 'background 0.2s'
          }}
          title="Tutup"
        >
          ✕
        </button>

        {/* Circular Icon */}
        <div 
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: '#e0f4f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px auto'
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#009aa6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </div>

        {/* Category Header */}
        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#009aa6', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>
          KELUAR AKUN
        </div>

        {/* Title */}
        <h3 style={{ margin: '0 0 10px 0', fontSize: '1.25rem', fontWeight: 800, color: '#0c1a24' }}>
          Yakin ingin keluar?
        </h3>

        {/* Description */}
        <p style={{ margin: '0 0 26px 0', fontSize: '0.82rem', color: '#64748b', lineHeight: 1.55 }}>
          Anda tidak akan menerima pembaruan status wilayah di perangkat ini sampai masuk kembali.
        </p>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              width: '100%',
              padding: '12px 20px',
              borderRadius: '10px',
              background: '#0c1a24',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.88rem',
              border: 'none',
              cursor: 'pointer',
              transition: 'background 0.2s',
              boxShadow: '0 4px 12px rgba(12, 26, 36, 0.2)'
            }}
          >
            Ya, keluar dari SIGAB
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: '100%',
              padding: '10px 16px',
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'color 0.2s'
            }}
          >
            Batalkan
          </button>
        </div>
      </div>
    </div>
  )
}
