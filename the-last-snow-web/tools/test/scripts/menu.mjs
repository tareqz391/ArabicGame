export default async ({ shot, fps, log }) => {
  await shot('00_menu');
  log('fps(menu, software GL) ' + await fps());
};
