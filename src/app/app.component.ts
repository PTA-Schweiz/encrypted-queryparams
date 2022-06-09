import { Component, OnInit } from '@angular/core';
import { Form, FormBuilder, FormControl, FormGroup } from '@angular/forms';
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
  dataString = ''
  rawLength = 0;
  base64StringBeforeEncryption = "";
  byteArrayBeforeEncryption = new Uint8Array();

  byteArrayAfterEncryption = new Uint8Array();
  encryptedBase64 = "";
  aesKeyBase64 = ""
  encoder = new TextEncoder();

  publicKey?: CryptoKey;
  aesKey?: CryptoKey;
  wrappedKeyBase64 = '';
  ivBase64 = '';
  url = '';
  urlFormControl: FormControl;
  publicKeyInput: FormControl;

  constructor(private builder: FormBuilder) {
    faker.setLocale('es');

    this.urlFormControl = new FormControl('http://localhost:4200');
    this.publicKeyInput = new FormControl("-----BEGIN PUBLIC KEY-----\n" +
      "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA4R9L578Mfy9QOKLY99pw\n" +
      "gyy47tFzGWocbJvTLjoUMBfi2fU1H8WKzp5FQtppkLn8/6YnE5icYhzEmT3vN+Q2\n" +
      "Pq+EkfC44n6Ja/x0SwvT69yxT42CPISthxEbwvgHNvmQEwP7B2zVsB950l/q2GjV\n" +
      "WB+fGGN2ZO8YnYR13A8FJScZVCwnMybRUyzq/3zB+evuGpy3JnsPT+XgxMo8IIFW\n" +
      "gwdKYmRPcApjyghSuk6QygkccoBAimw2eM8h6HqWJ4bWCeEbePWUuQK7Q2Wyfhsu\n" +
      "XBNA4BB5kkBu1BSyIxnWIpYnHpIUV5raS2nAgM6rHQ9iAScMp6KX7LM/Xtl3t2py\n" +
      "AQIDAQAB\n" +
      "-----END PUBLIC KEY-----");

    this.formGroup = builder.group({
      salutation: new FormControl(''),
      firstName: new FormControl(''),
      lastName: new FormControl(''),
      street: new FormControl(''),
      postalCode: new FormControl(''),
      city: new FormControl(''),
      line2: new FormControl(''),
      line3: new FormControl(''),
      birthDate: new FormControl(''),
      nationality: new FormControl(''),
      phoneNumber: new FormControl(''),
      mobileNumber: new FormControl(''),
      emailAddress: new FormControl(''),
      language: new FormControl(''),
      externalId1: new FormControl(''),
    });

    window.crypto.subtle.importKey(
      "spki",
      this.convertPemToBinary(
        // This key should be loaded from server at https://vtr-api.orion.ch/api/v1/decryption/publickey
        this.publicKeyInput.value),
        {   //these are the algorithm options
          name: "RSA-OAEP",
          hash: {name: "SHA-256"}, //can be "SHA-1", "SHA-256", "SHA-384", or "SHA-512"
        },
      true,
      ["encrypt", "wrapKey"]).then(
      (key) => {
        this.publicKey = key;
        this.generateWrappedKey();
      }
    );
    window.crypto.subtle.generateKey(
      {
        name: "AES-CBC",
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
      this.dataString = JSON.stringify(value);
      this.rawLength = this.dataString.length;

      this.byteArrayBeforeEncryption = this.encoder.encode(this.dataString);
      this.base64StringBeforeEncryption = this.toBase64(this.byteArrayBeforeEncryption);

      if (this.aesKey) {
        this.encryptMessage(this.aesKey).then(() =>{
          this.generateUrl();
        });
      }

    });

    this.urlFormControl.valueChanges.subscribe(() => {
      this.generateUrl();
    });

  }


  generateValues() {
    let values = {
      salutation: faker.name.gender(),
      firstName: faker.name.firstName(),
      lastName: faker.name.lastName(),
      street: faker.address.streetAddress(),
      postalCode: faker.address.zipCode(),
      city: faker.address.city(),
      line2: faker.address.secondaryAddress(),
      line3: faker.address.secondaryAddress(),
      birthDate: faker.date.past().toISOString(),
      nationality: faker.address.countryCode(),
      phoneNumber: faker.phone.phoneNumber(),
      mobileNumber: faker.phone.phoneNumber(),
      emailAddress: faker.internet.email(),
      language: faker.locale,
      externalId1: '49038823'
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
    let iv = window.crypto.getRandomValues(new Uint8Array(16));
    let encrypted: ArrayBuffer = await window.crypto.subtle.encrypt(
      {
        name: "AES-CBC",
        iv
      },
      key,
      this.byteArrayBeforeEncryption
    );
    this.ivBase64 = this.toBase64(iv);
    window.crypto.subtle.exportKey('raw', key).then(
      exp => this.aesKeyBase64 = this.toBase64(new Uint8Array(exp))
    );
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
    }).toString();
    this.url = this.urlFormControl.value + '/offer/new?' + qp;
  }

  /**
   * https://github.com/mdn/dom-examples/blob/master/web-crypto/import-key/spki.js
   * @param pem
   */
  convertPemToBinary(pem: string) {
    pem = pem.replace(/(\r\n|\n|\r)/gm, "");
    const pemHeader = "-----BEGIN PUBLIC KEY-----";
    const pemFooter = "-----END PUBLIC KEY-----";
    const pemContents = pem.substring(pemHeader.length, pem.length - pemFooter.length);
    return this.base64StringToArrayBuffer(pemContents);
  }

  base64StringToArrayBuffer(b64str: string) {
    var byteStr = atob(b64str)
    var bytes = new Uint8Array(byteStr.length)
    for (var i = 0; i < byteStr.length; i++) {
      bytes[i] = byteStr.charCodeAt(i)
    }
    return bytes.buffer
  }
}
