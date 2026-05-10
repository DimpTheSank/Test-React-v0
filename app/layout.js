export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '56px',
          backgroundColor: '#3B9EE8',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: '20px',
          paddingRight: '20px',
          zIndex: 1000,
        }}>
          {/* Sau này thêm nút và label vào đây */}
        </header>

        <main style={{ marginTop: '56px' }}>
          {children}
        </main>
      </body>
    </html>
  )
}