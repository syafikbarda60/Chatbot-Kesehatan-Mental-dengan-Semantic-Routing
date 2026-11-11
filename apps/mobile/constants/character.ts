// Companion character images, from the design team's half-body set in assets/Character/source, trimmed
// and centred on a 546px transparent square. tenang, wink, malu, mengantuk, terkejut and capek (bosan)
// are recombined from those same layers; expressions without their own art reuse the nearest face.
import type { ImageSourcePropType } from 'react-native';
import type { Expression } from '@prototype/utils';

export const CHARACTER: Record<Expression, ImageSourcePropType> = {
  menyapa:   require('../assets/Character/expressions/menyapa.png'),
  senang:    require('../assets/Character/expressions/senang.png'),
  tertawa:   require('../assets/Character/expressions/tertawa.png'),
  wink:      require('../assets/Character/expressions/wink.png'),
  semangat:  require('../assets/Character/expressions/semangat.png'),
  tenang:    require('../assets/Character/expressions/tenang.png'),
  berpikir:  require('../assets/Character/expressions/berpikir.png'),
  bingung:   require('../assets/Character/expressions/bingung.png'),
  terkejut:  require('../assets/Character/expressions/terkejut.png'),
  malu:      require('../assets/Character/expressions/malu.png'),
  mengantuk: require('../assets/Character/expressions/mengantuk.png'),
  jempol:    require('../assets/Character/expressions/jempol.png'),
  sedih:     require('../assets/Character/expressions/sedih.png'),
  kecewa:    require('../assets/Character/expressions/kecewa.png'),
  cemas:     require('../assets/Character/expressions/cemas.png'),
  pusing:    require('../assets/Character/expressions/pusing.png'),
  bosan:     require('../assets/Character/expressions/bosan.png'),
  harapan:   require('../assets/Character/expressions/harapan.png'),
};
