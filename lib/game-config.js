/* The ONLY file that differs between demo and production.
 * IT: set transport to 'server' and serverUrl to the deployed classroom server. */
export default Object.freeze({
  gameId: 'monster-gacha',          // lowercase-dash
  gameVersion: '1.0.0',
  pace: 'self',                   // 'self' = each student moves on their own | 'teacher' = teacher presses Next
  maxPlayers: 4,
  lateJoin: 'current',            // 'current' | 'next-round'
  revealAnswers: 'immediate',     // 'immediate' | 'all-submitted' (teacher pace only)

  transport: 'server',             // Chế độ máy chủ online
  serverUrl: 'wss://monster-server-abrr.onrender.com/ws', // Máy chủ WebSocket của bạn

  // Local demo only. In server mode the server reads the source configured by the content owner.
  localContent: {
    url: 'content.json',
    allowedHosts: []
  }
});
