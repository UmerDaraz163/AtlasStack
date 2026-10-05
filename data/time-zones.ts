/** Time zones layer: 24 nominal zones, each 15° of longitude wide. */

/** Time zones: 24 nominal zones of 15°. Example places observe the offset as standard time. */
export const TIME_ZONE_STYLE = { color: '#334155' };
export const TIME_ZONE_EXAMPLES: Record<string, string> = {
  '-12': 'Baker Island', '-11': 'American Samoa', '-10': 'Honolulu', '-9': 'Anchorage',
  '-8': 'Los Angeles, Vancouver', '-7': 'Denver, Calgary', '-6': 'Chicago, Mexico City',
  '-5': 'New York, Lima', '-4': 'Halifax, La Paz', '-3': 'Buenos Aires, São Paulo',
  '-2': 'South Georgia', '-1': 'Azores, Cape Verde', '0': 'London, Accra',
  '1': 'Berlin, Lagos', '2': 'Cairo, Johannesburg', '3': 'Moscow, Nairobi',
  '4': 'Dubai, Baku', '5': 'Karachi, Tashkent', '6': 'Dhaka, Bishkek',
  '7': 'Bangkok, Jakarta', '8': 'Beijing, Singapore, Perth', '9': 'Tokyo, Seoul',
  '10': 'Sydney, Vladivostok', '11': 'Solomon Islands, Nouméa', '12': 'Auckland, Fiji'
};
