export default function Home() {
  return (
    <main style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: 'calc(100vh - 56px)',
    }}>
      <div style={{
        border: '1px solid #ddd',
        borderRadius: '16px',
        padding: '40px',
        width: '360px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        backgroundColor: '#EEF6FF',
      }}>
        <h2 style={{ margin: 0, textAlign: 'center' }}>Đăng nhập</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label>Tài khoản</label>
          <input
            type="text"
            placeholder="Nhập tài khoản"
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid #ccc',
              fontSize: '14px',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label>Mật khẩu</label>
          <input
            type="password"
            placeholder="Nhập mật khẩu"
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid #ccc',
              fontSize: '14px',
            }}
          />
        </div>
      </div>
    </main>
  )
}