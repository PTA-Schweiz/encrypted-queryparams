import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import * as faker from 'faker';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit{
  title = 'EncryptedQueryParams';
  formGroup: FormGroup;

  onDestroy = new Subject<void>();
  queryString = ''
  rawLength = 0;
  base64StringBeforeEncryption = "";
  byteArrayBeforeEncryption = new Uint8Array();

  byteArrayAfterEncryption = new Uint8Array();
  encryptedBase64 = "";
  encoder = new TextEncoder();

  publicKey?: CryptoKey;
  aesKey?: CryptoKey;
  wrappedKeyBase64 = '';
  ivBase64 = '';
  url = '';

  constructor(private builder: FormBuilder) {
    faker.setLocale('es');
    this.formGroup = builder.group({
      gender: new FormControl(''),
      firstName: new FormControl(''),
      lastName: new FormControl(''),
      street: new FormControl(''),
      postalCode: new FormControl(''),
      city: new FormControl(''),
      addressLine1: new FormControl(''),
      addressLine2: new FormControl(''),
      birthDate: new FormControl(''),
      nationality: new FormControl(''),
      phone: new FormControl(''),
      mobile: new FormControl(''),
      email: new FormControl(''),
      correspondenceLanguage: new FormControl(''),
    });

    window.crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        // Consider using a 4096-bit key for systems that require long-term security
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["encrypt", "decrypt", "wrapKey"]).then(
      (keypair) => {
        this.publicKey = keypair.publicKey;
        this.generateWrappedKey();
      }
    );
    window.crypto.subtle.generateKey(
      {
        name: "AES-GCM",
        length: 256,
      },
      true,
      ["encrypt", "decrypt"]).then(
      (key) => {
        this.aesKey = key;
        this.generateWrappedKey();
      }
    );

  }

  ngOnInit(): void {
    this.formGroup.valueChanges.pipe(
      takeUntil(this.onDestroy)
    ).subscribe(value => {
      this.queryString = new URLSearchParams(value).toString();
      this.rawLength = this.queryString.length;

      this.byteArrayBeforeEncryption = this.encoder.encode(this.queryString);
      this.base64StringBeforeEncryption = this.toBase64(this.byteArrayBeforeEncryption);

      if (this.aesKey) {
        this.encryptMessage(this.aesKey).then(() =>{
          this.generateUrl();
        });
      }

    });

  }


  generateValues() {
    let values = {
      gender: faker.name.gender(),
      firstName: faker.name.firstName(),
      lastName: faker.name.lastName(),
      street: faker.address.streetAddress(),
      postalCode: faker.address.zipCode(),
      city: faker.address.city(),
      addressLine1: faker.address.secondaryAddress(),
      addressLine2: faker.address.secondaryAddress(),
      birthDate: faker.date.past().toISOString(),
      nationality: faker.address.countryCode(),
      phone: faker.phone.phoneNumber(),
      mobile: faker.phone.phoneNumber(),
      email: faker.internet.email(),
      correspondenceLanguage: faker.locale
    }
    this.formGroup.patchValue(values);

  }

  private toBase64(byteArray: Uint8Array): string {
    let result = '';
    for (let i = 0; i < byteArray.byteLength; i++) {
      result += String.fromCharCode(byteArray[i]);
    }
    return btoa(result);
  }


  async encryptMessage(key: CryptoKey) {
    let iv = window.crypto.getRandomValues(new Uint8Array(12));
    let encrypted: ArrayBuffer = await window.crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv
      },
      key,
      this.byteArrayBeforeEncryption
    );
    this.ivBase64 = this.toBase64(iv);
    this.encryptedBase64 = this.toBase64(new Uint8Array(encrypted, 0, encrypted.byteLength));
  }

  async generateWrappedKey() {
    if(!(this.aesKey && this.publicKey)) { return; }
    let keyData: ArrayBuffer = await window.crypto.subtle.wrapKey(
      "raw",
      this.aesKey,
      this.publicKey,
      {
        name: "RSA-OAEP"
      }
    )
    this.wrappedKeyBase64 = this.toBase64(new Uint8Array(keyData, 0, keyData.byteLength));
  }

  generateUrl() {
    let qp = new URLSearchParams({
      data: this.encryptedBase64,
      key: this.wrappedKeyBase64,
      iv: this.ivBase64,
      source: 'zuerich-kzp',
      externalId: '49038823'
    }).toString();
    this.url = 'https://vtr.orion.ch/offers/new?' + qp;
  }

}
