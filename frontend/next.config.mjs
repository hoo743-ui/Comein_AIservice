/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // COMEIN_ENTRY=reimagine 로 빌드된 배포는 루트(/)가 바로 reimagine 으로 열린다.
  // (메인 배포는 이 env 없이 빌드 → 랜딩+워크스페이스 그대로)
  async redirects() {
    if (process.env.COMEIN_ENTRY === "reimagine") {
      // 첫 진입은 opening(로그인 시네마틱)을 관문으로 → 이후 workspace 로.
      return [{ source: "/", destination: "/reimagine/opening", permanent: false }];
    }
    return [];
  },
};

export default nextConfig;
