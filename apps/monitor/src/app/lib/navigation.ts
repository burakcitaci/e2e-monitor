export const navigationItems = [
  { title: 'Messages', url: '/' },
  { title: 'Resources', url: '/messaging-resources' },
  { title: 'Policies', url: '/policies' },
] as const;

export function isNavigationActive(pathname: string, url: string) {
  if (url === '/') return pathname === '/' || pathname.startsWith('/messages/');
  return pathname === url || pathname.startsWith(`${url}/`);
}

export function pageTitle(pathname: string) {
  if (pathname.startsWith('/messages/')) return 'Message details';
  if (pathname.startsWith('/policies/')) return 'Policy details';
  if (pathname === '/chat') return 'Messaging Chat';
  return (
    navigationItems.find((item) => item.url === pathname)?.title ?? 'Messages'
  );
}
