import { Head, Html, Main, NextScript } from "next/document";
import Document from "next/document";

class FynDocument extends Document {
  render() {
    const locale = (this.props as { __NEXT_DATA__?: { locale?: string } }).__NEXT_DATA__?.locale ?? "es";

    return (
      <Html lang={locale}>
        <Head>
          <link rel="icon" href="/web/fynlogo.png" />
          <meta name="theme-color" content="#f5f4ef" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:opsz,wght@14..32,300;14..32,400;14..32,500;14..32,600&display=swap"
            rel="stylesheet"
          />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default FynDocument;
