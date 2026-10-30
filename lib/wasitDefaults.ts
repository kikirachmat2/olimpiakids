// Fallback matches cache from Google Sheets
export interface WasitParticipant {
  position: number
  bib_number: string
  name: string
  urutan?: string | number | null
  status?: 'registered' | 'finished' | 'dnf' | 'dns'
}

export interface WasitMatch {
  id: number
  title: string
  participants: WasitParticipant[]
}

export const DEFAULT_MATCHES: WasitMatch[] = [
  {
    "id": 1,
    "title": "MATCH 1 (051 B - 057 B)",
    "participants": [
      {
        "position": 1,
        "bib_number": "051B",
        "name": "ELANIAYU SUKMA WIJAYA",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 2,
        "bib_number": "052B",
        "name": "LEICA ROSE WIJAYA",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 3,
        "bib_number": "053B",
        "name": "CHAIRIL ISNAIN RABBANI",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 4,
        "bib_number": "054B",
        "name": "MATTHEW CHRISFELIX SIJABAT",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 5,
        "bib_number": "055B",
        "name": "SACHELVA FADYARA ANAMI",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 6,
        "bib_number": "056B",
        "name": "RALINKA ARBEENA PRATAMA",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 7,
        "bib_number": "057B",
        "name": "GHAISAN SAKHA RAJASWA",
        "urutan": null,
        "status": "registered"
      }
    ]
  },
  {
    "id": 2,
    "title": "MATCH 2 (058 B - 002 A)",
    "participants": [
      {
        "position": 1,
        "bib_number": "058B",
        "name": "ZEAN ARKANA SADENDRA",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 2,
        "bib_number": "059B",
        "name": "JOEL",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 3,
        "bib_number": "060B",
        "name": "RHYS NAEL",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 4,
        "bib_number": "279F",
        "name": "AISHA KIRANA AZALEA",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 5,
        "bib_number": "001A",
        "name": "SAVANA MONTANA MAULDY",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 6,
        "bib_number": "002A",
        "name": "ROCHELLE VALENCIA GOUW",
        "urutan": null,
        "status": "registered"
      }
    ]
  },
  {
    "id": 3,
    "title": "MATCH 3 (101 C - 106 C)",
    "participants": [
      {
        "position": 1,
        "bib_number": "101C",
        "name": "JOWEN AGASSI CHANDRAKA",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 2,
        "bib_number": "102C",
        "name": "KANAEL RANEZZA PURNOMO",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 3,
        "bib_number": "103C",
        "name": "AZKARA SKY ALBIRRU",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 4,
        "bib_number": "104C",
        "name": "MUHAMMAD ALFATH KARIM",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 5,
        "bib_number": "105C",
        "name": "RAISHIENA DITAMI",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 6,
        "bib_number": "106C",
        "name": "ASHA DAVINKA BACHTIAR",
        "urutan": null,
        "status": "registered"
      }
    ]
  },
  {
    "id": 4,
    "title": "MATCH 4 (151 D - 160 D)",
    "participants": [
      {
        "position": 1,
        "bib_number": "151D",
        "name": "RAFANDRA KHANDRA ABQARY",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 2,
        "bib_number": "152D",
        "name": "DASCHA LYUBOV BRIELLYANT WIJAYA",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 3,
        "bib_number": "153D",
        "name": "FATHAN SETYO NAKANDRA",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 4,
        "bib_number": "154D",
        "name": "CEISYA ANINDYA",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 5,
        "bib_number": "155D",
        "name": "ARSHAKALIEF IBRAM SAPUTRA",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 6,
        "bib_number": "156D",
        "name": "RANTAKA DIEN MAKKIY ISKAN NALADHIPA",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 7,
        "bib_number": "157D",
        "name": "NADLYNE FELICIA REY SERAPHINE",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 8,
        "bib_number": "158D",
        "name": "DANISHA ABIDAH NUSAIBAH",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 9,
        "bib_number": "159D",
        "name": "ZAYYAN ZAYD ABDUROHMAN",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 10,
        "bib_number": "160D",
        "name": "ARVENZIO GEVANSHA ADIANDRA",
        "urutan": null,
        "status": "registered"
      }
    ]
  },
  {
    "id": 5,
    "title": "MATCH 5 (201 E - 210 E)",
    "participants": [
      {
        "position": 1,
        "bib_number": "201E",
        "name": "BELLA LUNA ADHIGUNA",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 2,
        "bib_number": "202E",
        "name": "ABIDZAR ADIFA ALGHANY",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 3,
        "bib_number": "203E",
        "name": "NIRBITA KIRANA NARESWARI",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 4,
        "bib_number": "204E",
        "name": "ZHAFIRA HUMAIRA SYARIFA",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 5,
        "bib_number": "205E",
        "name": "UWAIS AHMAD AFASY AL JAMILI",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 6,
        "bib_number": "206E",
        "name": "JE NEIRA MOUTISYA AMORY",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 7,
        "bib_number": "207E",
        "name": "MUHAMMAD NUGI ATHARAZKA",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 8,
        "bib_number": "208E",
        "name": "DEVANO FARISQY YUSUF",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 9,
        "bib_number": "209E",
        "name": "ZIVANA PUTRI RAYANA",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 10,
        "bib_number": "210E",
        "name": "ANZARA ZAHIA AIZHA",
        "urutan": null,
        "status": "registered"
      }
    ]
  },
  {
    "id": 6,
    "title": "MATCH 6 (211 E - 216 E)",
    "participants": [
      {
        "position": 1,
        "bib_number": "211E",
        "name": "JENNARA GAURI LARASATI",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 2,
        "bib_number": "212E",
        "name": "KENZIO ALIFRIZKY KIANO",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 3,
        "bib_number": "213E",
        "name": "JENNAIRA QIANA AL FARUQ",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 4,
        "bib_number": "214E",
        "name": "GIOVANNI ELIO GULTOM",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 5,
        "bib_number": "215E",
        "name": "GEORGE MARSTON HEALEY",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 6,
        "bib_number": "216E",
        "name": "FAHIRA ZARIN",
        "urutan": null,
        "status": "registered"
      }
    ]
  },
  {
    "id": 7,
    "title": "MATCH 7 (217 E - 222 E)",
    "participants": [
      {
        "position": 1,
        "bib_number": "217E",
        "name": "RAYYAN NADI ATTARAZKA RAMADHAN",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 2,
        "bib_number": "218E",
        "name": "MARYAM MARSYACA ASSYIFA",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 3,
        "bib_number": "219E",
        "name": "KANYA",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 4,
        "bib_number": "220E",
        "name": "KANAKA NEIL AL KHALIF",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 5,
        "bib_number": "221E",
        "name": "REINA PUTRI RAHMAN",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 6,
        "bib_number": "222E",
        "name": "OMAR AHMAD RAWDAN NUGROHO",
        "urutan": null,
        "status": "registered"
      }
    ]
  },
  {
    "id": 8,
    "title": "MATCH 8 (251 F - 260 F)",
    "participants": [
      {
        "position": 1,
        "bib_number": "251F",
        "name": "MUHAMMAD KAEL RAMADHAN",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 2,
        "bib_number": "252F",
        "name": "MELVI KEYDEN ALFAREZ",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 3,
        "bib_number": "253F",
        "name": "KAYLO",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 4,
        "bib_number": "254F",
        "name": "CHALIPH CAVENDISH HAZZINAYR",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 5,
        "bib_number": "255F",
        "name": "KAIVANDRA ARRASH NAWASENA",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 6,
        "bib_number": "256F",
        "name": "BILLIE SHINE FRADESS",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 7,
        "bib_number": "257F",
        "name": "JENNAIRA SAFEEYA YASMIN",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 8,
        "bib_number": "258F",
        "name": "ARSYNAYA MAISHA PRASETYA",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 9,
        "bib_number": "259F",
        "name": "ZEYNA AL MERA",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 10,
        "bib_number": "260F",
        "name": "YURIN SAFIYYA KHAIRANI",
        "urutan": null,
        "status": "registered"
      }
    ]
  },
  {
    "id": 9,
    "title": "MATCH 9 (261 F - 270 F)",
    "participants": [
      {
        "position": 1,
        "bib_number": "261F",
        "name": "AZMIRA NAYANIKA ADYAREZA",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 2,
        "bib_number": "262F",
        "name": "AVIYANTI NAMI",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 3,
        "bib_number": "263F",
        "name": "MUHAMMAD GHAISANRA SETIAWAN",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 4,
        "bib_number": "264F",
        "name": "IMRAN",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 5,
        "bib_number": "265F",
        "name": "MUHAMMAD ZAYN ARRAYAN",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 6,
        "bib_number": "266F",
        "name": "MUHAMMAD BILAL AR RASYAD",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 7,
        "bib_number": "267F",
        "name": "ALANA SOPHIA MAHESWARI",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 8,
        "bib_number": "268F",
        "name": "JEANETTA LIORA WATTIMENA",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 9,
        "bib_number": "269F",
        "name": "MUHAMMAD NABIL",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 10,
        "bib_number": "270F",
        "name": "ZAVIER ABDULLAH OMAR",
        "urutan": null,
        "status": "registered"
      }
    ]
  },
  {
    "id": 10,
    "title": "MATCH 10 (271 F - 280 F)",
    "participants": [
      {
        "position": 1,
        "bib_number": "271F",
        "name": "M. DIRGA ARSYANENDRA",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 2,
        "bib_number": "272F",
        "name": "QUEENARA ZELINA ANWAR",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 3,
        "bib_number": "273F",
        "name": "GAURAVA ELZAN SAPUTRA",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 4,
        "bib_number": "274F",
        "name": "HEZELYN NARASYA MILENA",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 5,
        "bib_number": "275F",
        "name": "ALEENA JENNAIRA ILHAM",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 6,
        "bib_number": "276F",
        "name": "YEMIMA IALOINA ELSHALOM BANJARNAHOR",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 7,
        "bib_number": "277F",
        "name": "LYZIA AYUMI YUNDA",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 8,
        "bib_number": "278F",
        "name": "HAURA SHAFIYA SYARIF",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 9,
        "bib_number": "280F",
        "name": "MIKHAEL PHILEMON BUNGARAN SAGALA",
        "urutan": null,
        "status": "registered"
      }
    ]
  },
  {
    "id": 11,
    "title": "MATCH 11 (281 F - 290 F)",
    "participants": [
      {
        "position": 1,
        "bib_number": "281F",
        "name": "RAQUELLA ACELINE",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 2,
        "bib_number": "282F",
        "name": "M. ZHAFRAN SHAMEER",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 3,
        "bib_number": "283F",
        "name": "FAREEZ ALKAUTSAR HADISTY",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 4,
        "bib_number": "284F",
        "name": "MADHAVA EZAN PRANATA",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 5,
        "bib_number": "285F",
        "name": "ARUNIKA NADIRA SEMBIRING",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 6,
        "bib_number": "286F",
        "name": "MELUR HUMAIRA PUTRI MELAZ",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 7,
        "bib_number": "287F",
        "name": "RAIZ EZHAR ALHAFIDZ",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 8,
        "bib_number": "288F",
        "name": "FREYA KALUNA",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 9,
        "bib_number": "289F",
        "name": "MUHAMMAD BILAL ZAIDAN",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 10,
        "bib_number": "290F",
        "name": "EZAYDEN DAVID HURRAIRA",
        "urutan": null,
        "status": "registered"
      }
    ]
  },
  {
    "id": 12,
    "title": "MATCH 12 (291 F - 298 F)",
    "participants": [
      {
        "position": 1,
        "bib_number": "291F",
        "name": "MUHAMMAD ARZHIAN RAMADHAN",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 2,
        "bib_number": "292F",
        "name": "VALESKA DEVANI SETIAWAN",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 3,
        "bib_number": "293F",
        "name": "ARASH KAMAYEL NEESHAM MULYA",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 4,
        "bib_number": "294F",
        "name": "FARHAN GARDAPATI HANDOKO",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 5,
        "bib_number": "295F",
        "name": "MARCELIANO ZEMAEL CAIDEN LADJA",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 6,
        "bib_number": "296F",
        "name": "ARTANAMI MUHAMMAD BATUBARA",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 7,
        "bib_number": "297F",
        "name": "LAUTAN ATALARIC DAMEER",
        "urutan": null,
        "status": "registered"
      },
      {
        "position": 8,
        "bib_number": "298F",
        "name": "MUHAMMAD NABEEL SATRIA",
        "urutan": null,
        "status": "registered"
      }
    ]
  }
]
