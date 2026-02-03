
import { Language, LibraryItem } from './types';

export const INITIAL_DATA: LibraryItem[] = [
  {
    id: 'agpeya',
    title: 'The Agpeya (Hours)',
    type: 'category',
    children: [
      {
        id: 'agpeya-prime',
        title: 'The First Hour (Prime)',
        type: 'book',
        sections: [
          {
            id: 'opening',
            title: 'Opening Prayer',
            parts: [
              {
                id: 'sign-cross',
                type: 'prayer',
                title: {
                  [Language.ENGLISH]: 'The Sign of the Cross',
                  [Language.COPTIC]: 'Ⲫⲉⲛ ⲫⲣⲁⲛ',
                  [Language.ARABIC]: 'باسم الآب'
                },
                content: {
                  [Language.ENGLISH]: ['In the name of the Father, and the Son, and the Holy Spirit, one God. Amen.'],
                  [Language.COPTIC]: ['Ϧⲉⲛ ⲫⲣⲁⲛ ⲙ̀Ⲫⲓⲱⲧ ⲛⲉⲙ Ⲡ̀ϣⲏⲣⲓ ⲛⲉⲙ Ⲡⲓⲡⲛⲉⲩⲙⲁ Ⲉⲑⲟⲩⲁⲃ ⲟⲩⲛⲟⲩϯ ⲛ̀ⲟⲩⲱⲧ: ⲁⲙⲏⲛ.'],
                  [Language.ARABIC]: ['باسم الآب والابن والروح القدس، إله واحد. آمين.']
                }
              },
              {
                id: 'lords-prayer',
                type: 'prayer',
                title: {
                  [Language.ENGLISH]: "The Lord's Prayer",
                  [Language.ARABIC]: 'أبانا الذي في السموات'
                },
                content: {
                  [Language.ENGLISH]: [
                    'Our Father who art in heaven, hallowed be Thy name.',
                    'Thy kingdom come, Thy will be done, on earth as it is in heaven.',
                    'Give us this day our daily bread.'
                  ],
                  [Language.COPTIC]: [
                    'Ⲡⲉⲛⲓⲱⲧ ⲉⲧϦⲉⲛ ⲛⲓⲫⲏⲟⲩⲓ: ⲙⲁⲣⲉϥⲧⲟⲩⲃⲟ ⲛ̀ϫⲉ ⲡⲉⲕⲣⲁⲛ:',
                    'ⲙⲁⲣⲉⲥⲓ ⲛ̀ϫⲉ ⲧⲉⲕⲙⲉⲧⲟⲩⲣⲟ: ⲡⲉⲧⲉϩⲛⲁⲕ ⲙⲁⲣⲉϥϣⲱⲡⲓ:'
                  ],
                  [Language.ARABIC]: [
                    'أبانا الذي في السموات، ليتقدس اسمك. ليأت ملكوتك. لتكن مشيئتك كما في السماء كذلك على الأرض.',
                    'خبزنا الذي للغد أعطنا اليوم.'
                  ]
                }
              }
            ]
          }
        ]
      },
      {
        id: 'agpeya-vespers',
        title: 'The Eleventh Hour (Vespers)',
        type: 'book',
        sections: []
      }
    ]
  },
  {
    id: 'liturgy',
    title: 'Divine Liturgy',
    type: 'category',
    children: [
      {
        id: 'st-basil',
        title: 'St. Basil Liturgy',
        type: 'book',
        sections: [
          {
            id: 'offertory',
            title: 'Offertory',
            parts: [
              {
                id: 'hymn-alleluia',
                type: 'hymn',
                title: { [Language.ENGLISH]: 'Alleluia' },
                content: {
                  [Language.ENGLISH]: ['Alleluia. This is the day which the Lord has made.'],
                  [Language.COPTIC]: ['Ⲁⲗⲗⲏⲗⲟⲩⲓⲁ: ⲫⲁⲓ ⲡⲉ ⲡⲓⲉϩⲟⲟⲩ ⲉⲧⲁ Ⲡ̀ϭⲟⲓⲥ ⲑⲁⲙⲓⲟϥ.'],
                  [Language.ARABIC]: ['هلليلويا. هذا هو اليوم الذي صنعه الرب.']
                }
              }
            ]
          }
        ]
      }
    ]
  }
];
